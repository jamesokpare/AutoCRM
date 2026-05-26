"use server";

import { auth } from "@crm-tool/auth";
import { NotificationType, Role } from "@crm-tool/db";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { withMutation } from "@/lib/mutation";
import { createNotification } from "@/lib/notifications";
import type { ActionResult } from "./feedback-types";

interface SessionUser {
  id: string;
  roles?: Role[] | null;
  isApproved?: boolean | null;
}

const LOW_RATING_THRESHOLD = 2;

/**
 * FB-01: log feedback (rating 1–5 + optional comments) against a client and
 * optionally a specific order. Any authenticated + approved user may log it
 * (no specific edit capability in SPEC §5 — feedback logging is an internal
 * record-keeping action), so we only require an approved session.
 *
 * FB-04: a low rating (<= 2) creates a Notification row flagging follow-up for
 * managers/admins (pull-based centre — push deferred).
 */
export async function logFeedback(
  clientId: string,
  input: { rating: number; comments?: string; orderId?: string },
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const user = session?.user as SessionUser | undefined;
    if (!user) return { ok: false, error: "You must be signed in." };
    if (!user.isApproved) {
      return { ok: false, error: "Your account is awaiting approval before you can log feedback." };
    }

    const rating = Math.trunc(input.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return { ok: false, error: "Rating must be between 1 and 5." };
    }
    const comments = input.comments?.trim() || null;
    const orderId = input.orderId?.trim() || null;

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true },
    });
    if (!client) return { ok: false, error: "Client not found." };

    const feedback = await withMutation(
      {
        entityType: "Feedback",
        action: "created",
        userId: user.id,
        metadata: { clientId, orderId: orderId ?? undefined, rating },
      },
      async () =>
        prisma.feedback.create({
          data: { clientId, orderId, rating, comments, createdById: user.id },
        }),
      (f) => f.id,
    );

    // FB-04: flag low ratings to managers + admins for follow-up.
    if (rating <= LOW_RATING_THRESHOLD) {
      const recipients = await prisma.user.findMany({
        where: {
          OR: [{ roles: { has: Role.MANAGER } }, { roles: { has: Role.ADMIN } }],
          banned: { not: true },
        },
        select: { id: true },
      });
      await Promise.all(
        recipients.map((r) =>
          createNotification({
            userId: r.id,
            type: NotificationType.LOW_RATING,
            title: `Low rating (${rating}/5) from ${client.name}`,
            body: comments ?? undefined,
            link: `/clients/${clientId}`,
          }),
        ),
      );
    }

    revalidatePath(`/clients/${clientId}`);
    revalidatePath("/dashboard");
    return { ok: true, data: { id: feedback.id } };
  } catch (err) {
    if (err instanceof Error) return { ok: false, error: err.message };
    return { ok: false, error: "Something went wrong." };
  }
}
