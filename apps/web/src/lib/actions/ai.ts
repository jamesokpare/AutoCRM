"use server";

import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@crm-tool/auth";
import { CommunicationState, CommunicationType, OrderStatus, type Role } from "@crm-tool/db";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { withMutation } from "@/lib/mutation";
import { PermissionError, requirePermission } from "@/lib/rbac";
import type { ActionResult, ApologyTone, DraftApologyInput } from "./ai-types";

// Use Opus 4.7 per spec. Single-message drafting call — no thinking needed.
const MODEL = "claude-opus-4-7";

interface SessionUser {
  id: string;
  roles?: Role[] | null;
  isApproved?: boolean | null;
}

const TONE_GUIDANCE: Record<ApologyTone, string> = {
  formal: "Professional and formal. Complete sentences, respectful, no slang.",
  warm: "Warm, empathetic and personable, while staying professional.",
  brief: "Concise and to the point — a few short sentences at most.",
};

const APOLOGY_ELIGIBLE: OrderStatus[] = [OrderStatus.FAILED, OrderStatus.ON_HOLD];

/**
 * AI-01..05: draft a customer apology for an order that is FAILED, ON_HOLD, or
 * past its expected date. Requires `use_ai_apology`. The draft is NEVER sent —
 * it is saved as a Communication { type: APOLOGY, state: DRAFT } and returned
 * for the user to edit (AI-04). Logged on the client record (AI-05).
 */
export async function draftApology(
  input: DraftApologyInput,
): Promise<ActionResult<{ communicationId: string; content: string }>> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const user = session?.user as SessionUser | undefined;
    requirePermission(user ? { user } : null, "use_ai_apology");

    // TODO(env): ANTHROPIC_API_KEY is read directly from process.env because
    // packages/env/src/server.ts is a shared M1 file edited by other agents;
    // add it to that schema once the verticals merge.
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "AI drafting is not configured (missing ANTHROPIC_API_KEY)." };
    }

    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      include: {
        client: { select: { id: true, name: true } },
        vehicle: { select: { make: true, model: true, year: true } },
      },
    });
    if (!order) return { ok: false, error: "Order not found." };

    // AI-01 eligibility: FAILED / ON_HOLD / past expectedDate.
    const pastExpected = order.expectedDate ? order.expectedDate.getTime() < Date.now() : false;
    if (!APOLOGY_ELIGIBLE.includes(order.status) && !pastExpected) {
      return {
        ok: false,
        error: "Apology drafting is only available for failed, on-hold, or overdue orders.",
      };
    }

    const vehicle = `${order.vehicle.year} ${order.vehicle.make} ${order.vehicle.model}`;
    const language = input.language?.trim() || "English";

    const facts = [
      `Customer name: ${order.client.name}`,
      `Vehicle: ${vehicle}`,
      `Service / order description: ${order.description}`,
      `Current order status: ${order.status}`,
      order.statusReason ? `Reason for the delay/issue: ${order.statusReason}` : null,
      order.expectedDate
        ? `Originally promised completion date: ${order.expectedDate.toDateString()}`
        : null,
      pastExpected ? "This order is past its originally promised completion date." : null,
      `Delivery channel: ${input.channel}`,
    ]
      .filter(Boolean)
      .join("\n");

    const system =
      "You are a service advisor at an automotive repair shop writing a short apology " +
      "message to a customer about a delay or problem with their vehicle service. Write " +
      "only the message body — no subject line, no placeholders like [Name], no commentary. " +
      "Be sincere, take responsibility, and where possible set a clear next step or revised " +
      "expectation. Do not invent facts, dates, or compensation that were not provided.";

    const userPrompt =
      `Write an apology message in ${language} for delivery via ${input.channel}.\n\n` +
      `Tone: ${TONE_GUIDANCE[input.tone]}\n\n` +
      `Use only these facts:\n${facts}`;

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userPrompt }],
    });

    const content = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (!content) {
      return { ok: false, error: "The AI did not return a draft. Please try again." };
    }

    // AI-04/05: save as a DRAFT communication (never sent) and log it.
    const communication = await withMutation(
      {
        entityType: "Communication",
        action: "apology_drafted",
        userId: user!.id,
        metadata: { orderId: order.id, clientId: order.client.id, tone: input.tone },
      },
      async () =>
        prisma.communication.create({
          data: {
            clientId: order.client.id,
            orderId: order.id,
            channel: input.channel,
            type: CommunicationType.APOLOGY,
            state: CommunicationState.DRAFT,
            content,
            senderId: user!.id,
          },
        }),
      (c) => c.id,
    );

    revalidatePath(`/clients/${order.client.id}`);
    return { ok: true, data: { communicationId: communication.id, content } };
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    if (err instanceof Error) return { ok: false, error: err.message };
    return { ok: false, error: "Something went wrong drafting the apology." };
  }
}

/** Persist user edits to an apology draft before (future) sending. */
export async function updateApologyDraft(
  communicationId: string,
  content: string,
): Promise<ActionResult> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const user = session?.user as SessionUser | undefined;
    requirePermission(user ? { user } : null, "use_ai_apology");

    const clean = content?.trim();
    if (!clean) return { ok: false, error: "Draft cannot be empty." };

    const comm = await prisma.communication.findUnique({
      where: { id: communicationId },
      select: { id: true, clientId: true, state: true },
    });
    if (!comm) return { ok: false, error: "Draft not found." };
    if (comm.state !== CommunicationState.DRAFT) {
      return { ok: false, error: "Only drafts can be edited." };
    }

    await withMutation(
      { entityType: "Communication", action: "apology_edited", userId: user!.id, entityId: communicationId },
      async () =>
        prisma.communication.update({ where: { id: communicationId }, data: { content: clean } }),
    );

    revalidatePath(`/clients/${comm.clientId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    if (err instanceof Error) return { ok: false, error: err.message };
    return { ok: false, error: "Something went wrong." };
  }
}
