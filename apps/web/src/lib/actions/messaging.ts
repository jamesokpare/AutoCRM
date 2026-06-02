"use server";

import { auth } from "@crm-tool/auth";
import {
  BulkRecipientState,
  Channel,
  ClientStatus,
  CommunicationState,
  CommunicationType,
  EmailProvider,
  Prisma,
  type Role,
} from "@crm-tool/db";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { withMutation } from "@/lib/mutation";
import { PermissionError, requirePermission } from "@/lib/rbac";

import type {
  ActionResult,
  BulkClientOption,
  BulkSendInput,
  BulkSendResult,
  EmailSettingsInput,
  MessagingSettingsView,
  WhatsappSettingsInput,
} from "./messaging-types";

interface SessionUser {
  id: string;
  roles?: Role[] | null;
}

const SINGLETON_KEY = "singleton";

async function requireMessagingAdmin(): Promise<SessionUser> {
  const session = await auth.api.getSession({ headers: await headers() });
  requirePermission(
    session ? { user: { roles: (session.user as SessionUser).roles } } : null,
    "manage_messaging",
  );
  return session!.user as SessionUser;
}

async function requireSender(): Promise<SessionUser> {
  const session = await auth.api.getSession({ headers: await headers() });
  requirePermission(
    session ? { user: { roles: (session.user as SessionUser).roles } } : null,
    "send_bulk_messages",
  );
  return session!.user as SessionUser;
}

function fail(err: unknown): ActionResult<never> {
  if (err instanceof PermissionError) return { ok: false, error: err.message };
  if (err instanceof Error) return { ok: false, error: err.message };
  return { ok: false, error: "Something went wrong." };
}

/** Loads or upserts the singleton settings row and returns a safe public view. */
export async function getMessagingSettings(): Promise<MessagingSettingsView> {
  await requireMessagingAdmin();
  const row = await prisma.messagingSettings.findUnique({
    where: { key: SINGLETON_KEY },
  });
  if (!row) {
    return {
      whatsapp: {
        enabled: false,
        phoneNumberId: null,
        businessNumber: null,
        displayName: null,
        hasAccessToken: false,
      },
      email: {
        enabled: false,
        provider: null,
        fromName: null,
        fromAddress: null,
        hasApiKey: false,
        smtpHost: null,
        smtpPort: null,
        smtpUser: null,
        smtpSecure: null,
        hasSmtpPassword: false,
      },
      updatedAt: null,
    };
  }
  return {
    whatsapp: {
      enabled: row.whatsappEnabled,
      phoneNumberId: row.whatsappPhoneNumberId,
      businessNumber: row.whatsappBusinessNumber,
      displayName: row.whatsappDisplayName,
      hasAccessToken: Boolean(row.whatsappAccessToken),
    },
    email: {
      enabled: row.emailEnabled,
      provider: row.emailProvider,
      fromName: row.emailFromName,
      fromAddress: row.emailFromAddress,
      hasApiKey: Boolean(row.emailApiKey),
      smtpHost: row.emailSmtpHost,
      smtpPort: row.emailSmtpPort,
      smtpUser: row.emailSmtpUser,
      smtpSecure: row.emailSmtpSecure,
      hasSmtpPassword: Boolean(row.emailSmtpPassword),
    },
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function saveWhatsappSettings(
  input: WhatsappSettingsInput,
): Promise<ActionResult> {
  try {
    const user = await requireMessagingAdmin();
    const existing = await prisma.messagingSettings.findUnique({
      where: { key: SINGLETON_KEY },
    });

    const accessToken =
      input.accessToken && input.accessToken.trim().length > 0
        ? input.accessToken.trim()
        : existing?.whatsappAccessToken ?? null;

    if (input.enabled && (!input.phoneNumberId.trim() || !accessToken)) {
      return {
        ok: false,
        error: "Phone Number ID and Access Token are required to enable WhatsApp.",
      };
    }

    const data = {
      whatsappEnabled: input.enabled,
      whatsappPhoneNumberId: input.phoneNumberId.trim() || null,
      whatsappAccessToken: accessToken,
      whatsappBusinessNumber: input.businessNumber?.trim() || null,
      whatsappDisplayName: input.displayName?.trim() || null,
      updatedById: user.id,
    };

    await withMutation(
      {
        entityType: "MessagingSettings",
        action: "whatsapp_updated",
        userId: user.id,
        entityId: SINGLETON_KEY,
        metadata: { enabled: input.enabled },
      },
      async () =>
        prisma.messagingSettings.upsert({
          where: { key: SINGLETON_KEY },
          create: { key: SINGLETON_KEY, ...data },
          update: data,
        }),
    );
    revalidatePath("/admin/messaging");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function saveEmailSettings(
  input: EmailSettingsInput,
): Promise<ActionResult> {
  try {
    const user = await requireMessagingAdmin();
    const existing = await prisma.messagingSettings.findUnique({
      where: { key: SINGLETON_KEY },
    });

    const apiKey =
      input.apiKey && input.apiKey.trim().length > 0
        ? input.apiKey.trim()
        : existing?.emailApiKey ?? null;
    const smtpPassword =
      input.smtpPassword && input.smtpPassword.trim().length > 0
        ? input.smtpPassword
        : existing?.emailSmtpPassword ?? null;

    if (input.enabled) {
      if (!input.fromAddress.trim()) {
        return { ok: false, error: "From address is required to enable email." };
      }
      if (input.provider === EmailProvider.RESEND && !apiKey) {
        return { ok: false, error: "Resend API key is required." };
      }
      if (
        input.provider === EmailProvider.SMTP &&
        (!input.smtpHost?.trim() || !input.smtpPort)
      ) {
        return { ok: false, error: "SMTP host and port are required." };
      }
    }

    const data = {
      emailEnabled: input.enabled,
      emailProvider: input.provider,
      emailFromName: input.fromName?.trim() || null,
      emailFromAddress: input.fromAddress.trim() || null,
      emailApiKey: apiKey,
      emailSmtpHost: input.smtpHost?.trim() || null,
      emailSmtpPort: input.smtpPort ?? null,
      emailSmtpUser: input.smtpUser?.trim() || null,
      emailSmtpPassword: smtpPassword,
      emailSmtpSecure: input.smtpSecure ?? null,
      updatedById: user.id,
    };

    await withMutation(
      {
        entityType: "MessagingSettings",
        action: "email_updated",
        userId: user.id,
        entityId: SINGLETON_KEY,
        metadata: { provider: input.provider, enabled: input.enabled },
      },
      async () =>
        prisma.messagingSettings.upsert({
          where: { key: SINGLETON_KEY },
          create: { key: SINGLETON_KEY, ...data },
          update: data,
        }),
    );
    revalidatePath("/admin/messaging");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Sends a single test message via the currently-saved settings, without
 * persisting a BulkMessage row. Used by the admin page's "Send test" buttons.
 */
export async function sendTestMessage(args: {
  channel: Channel;
  destination: string;
  content: string;
  subject?: string;
}): Promise<ActionResult> {
  try {
    await requireMessagingAdmin();
    const settings = await prisma.messagingSettings.findUnique({
      where: { key: SINGLETON_KEY },
    });
    if (!settings) return { ok: false, error: "No messaging settings configured." };
    if (args.channel === Channel.WHATSAPP) {
      await sendWhatsappMessage(settings, args.destination, args.content);
    } else if (args.channel === Channel.EMAIL) {
      await sendEmailMessage(
        settings,
        args.destination,
        args.subject ?? "Drivewell test message",
        args.content,
      );
    } else {
      return { ok: false, error: "Unsupported channel." };
    }
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/** Lightweight client list for the bulk-send recipient picker. */
export async function listBulkClientOptions(): Promise<BulkClientOption[]> {
  await requireSender();
  const rows = await prisma.client.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      whatsapp: true,
      status: true,
    },
  });
  return rows;
}

/** Narrow a list of statuses to the recognised ClientStatus enum values. */
function normaliseStatusFilter(values: ClientStatus[] | undefined): ClientStatus[] | null {
  if (!values || values.length === 0) return null;
  const valid = new Set(Object.values(ClientStatus) as string[]);
  const filtered = values.filter((v) => valid.has(v));
  return filtered.length > 0 ? filtered : null;
}

/**
 * Bulk-send entry point. Hydrates the recipient list, renders the template
 * per-client, dispatches sequentially, and records the campaign + per-recipient
 * outcome. Errors on a single recipient never abort the whole batch.
 */
export async function sendBulkMessages(input: BulkSendInput): Promise<ActionResult<BulkSendResult>> {
  try {
    const user = await requireSender();
    const settings = await prisma.messagingSettings.findUnique({
      where: { key: SINGLETON_KEY },
    });
    if (!settings) return { ok: false, error: "Messaging is not configured yet." };
    if (input.channel === Channel.WHATSAPP && !settings.whatsappEnabled) {
      return { ok: false, error: "WhatsApp is not enabled." };
    }
    if (input.channel === Channel.EMAIL && !settings.emailEnabled) {
      return { ok: false, error: "Email is not enabled." };
    }
    if (!input.content.trim()) {
      return { ok: false, error: "Message content is required." };
    }
    if (input.channel === Channel.EMAIL && !input.subject?.trim()) {
      return { ok: false, error: "Subject is required for email." };
    }

    // Test send: don't load any clients, don't persist a campaign.
    if (input.testDestination) {
      if (input.channel === Channel.WHATSAPP) {
        await sendWhatsappMessage(settings, input.testDestination, input.content);
      } else {
        await sendEmailMessage(
          settings,
          input.testDestination,
          input.subject ?? "Drivewell",
          input.content,
        );
      }
      return {
        ok: true,
        data: { bulkMessageId: null, sent: 1, failed: 0, skipped: 0, details: [] },
      };
    }

    const clientIds =
      input.audience.mode === "selected" ? input.audience.clientIds : undefined;
    const statusFilter = normaliseStatusFilter(input.statusFilter);
    const where: Prisma.ClientWhereInput = {};
    if (clientIds) where.id = { in: clientIds };
    if (statusFilter) where.status = { in: statusFilter };
    const clients = await prisma.client.findMany({
      where: clientIds || statusFilter ? where : undefined,
      orderBy: { name: "asc" },
      include: {
        vehicles: { take: 1, orderBy: { updatedAt: "desc" } },
      },
    });
    if (clients.length === 0) return { ok: false, error: "No matching clients." };

    const bulk = await prisma.bulkMessage.create({
      data: {
        channel: input.channel,
        subject: input.subject ?? null,
        content: input.content,
        senderId: user.id,
        totalCount: clients.length,
      },
    });

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const details: BulkSendResult["details"] = [];

    for (const client of clients) {
      const destination = pickDestination(input.channel, client);
      if (!destination) {
        skipped += 1;
        await prisma.bulkMessageRecipient.create({
          data: {
            bulkMessageId: bulk.id,
            clientId: client.id,
            destination: "",
            state: BulkRecipientState.SKIPPED,
            error: `No ${input.channel.toLowerCase()} destination on file.`,
          },
        });
        if (details.length < 20) {
          details.push({
            clientId: client.id,
            clientName: client.name,
            destination: "",
            state: BulkRecipientState.SKIPPED,
            error: `No ${input.channel.toLowerCase()} destination on file.`,
          });
        }
        continue;
      }

      const personalised = renderTemplate(input.content, client);
      const subject = input.subject ? renderTemplate(input.subject, client) : undefined;

      try {
        if (input.channel === Channel.WHATSAPP) {
          await sendWhatsappMessage(settings, destination, personalised);
        } else {
          await sendEmailMessage(
            settings,
            destination,
            subject ?? "Drivewell",
            personalised,
          );
        }
        sent += 1;
        await prisma.bulkMessageRecipient.create({
          data: {
            bulkMessageId: bulk.id,
            clientId: client.id,
            destination,
            state: BulkRecipientState.SENT,
            sentAt: new Date(),
          },
        });
        // Per-client Communication row so the client detail timeline reflects the send.
        await prisma.communication.create({
          data: {
            clientId: client.id,
            channel: input.channel,
            type: CommunicationType.MANUAL,
            state: CommunicationState.SENT,
            content: subject ? `${subject}\n\n${personalised}` : personalised,
            senderId: user.id,
            sentAt: new Date(),
          },
        });
        if (details.length < 20) {
          details.push({
            clientId: client.id,
            clientName: client.name,
            destination,
            state: BulkRecipientState.SENT,
          });
        }
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : "Unknown error";
        await prisma.bulkMessageRecipient.create({
          data: {
            bulkMessageId: bulk.id,
            clientId: client.id,
            destination,
            state: BulkRecipientState.FAILED,
            error: message,
          },
        });
        if (details.length < 20) {
          details.push({
            clientId: client.id,
            clientName: client.name,
            destination,
            state: BulkRecipientState.FAILED,
            error: message,
          });
        }
      }
    }

    await withMutation(
      {
        entityType: "BulkMessage",
        action: "sent",
        userId: user.id,
        entityId: bulk.id,
        metadata: {
          channel: input.channel,
          total: clients.length,
          sent,
          failed,
          skipped,
        },
      },
      async () =>
        prisma.bulkMessage.update({
          where: { id: bulk.id },
          data: { sentCount: sent, failedCount: failed },
        }),
    );

    revalidatePath("/clients");
    return {
      ok: true,
      data: { bulkMessageId: bulk.id, sent, failed, skipped, details },
    };
  } catch (err) {
    return fail(err);
  }
}

// ─────────────────────────────────────────────────────────────
// Delivery: WhatsApp Cloud API (graph.facebook.com) + Email REST
// ─────────────────────────────────────────────────────────────

type Settings = Awaited<ReturnType<typeof prisma.messagingSettings.findUnique>>;

function pickDestination(
  channel: Channel,
  client: { phone: string | null; email: string | null; whatsapp: string | null },
): string | null {
  if (channel === Channel.WHATSAPP) {
    return (client.whatsapp ?? client.phone)?.trim() || null;
  }
  if (channel === Channel.EMAIL) {
    return client.email?.trim() || null;
  }
  return null;
}

/** Replaces {{var}} placeholders in a template with per-client values. */
function renderTemplate(
  template: string,
  client: {
    name: string;
    phone: string | null;
    email: string | null;
    whatsapp: string | null;
    vehicles?: { make: string; model: string; year: number; plate: string | null }[];
  },
): string {
  const first = client.name.split(/\s+/)[0] ?? client.name;
  const v = client.vehicles?.[0];
  const vehicle = v ? `${v.make} ${v.model} (${v.year})` : "your vehicle";
  const vars: Record<string, string> = {
    name: client.name,
    firstname: first,
    firstName: first,
    phone: client.phone ?? "",
    email: client.email ?? "",
    whatsapp: client.whatsapp ?? "",
    vehicle,
    plate: v?.plate ?? "",
  };
  return template.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (_, key: string) => {
    return vars[key] ?? vars[key.toLowerCase()] ?? "";
  });
}

/** Strips leading +/spaces/dashes — WhatsApp Cloud API wants E.164 digits only. */
function normalisePhoneForWhatsapp(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

async function sendWhatsappMessage(
  settings: NonNullable<Settings>,
  to: string,
  body: string,
): Promise<void> {
  if (!settings.whatsappPhoneNumberId || !settings.whatsappAccessToken) {
    throw new Error("WhatsApp credentials missing.");
  }
  const phone = normalisePhoneForWhatsapp(to);
  if (!phone) throw new Error("Invalid phone number.");
  const url = `https://graph.facebook.com/v20.0/${encodeURIComponent(settings.whatsappPhoneNumberId)}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.whatsappAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      type: "text",
      text: { preview_url: false, body },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`WhatsApp API ${res.status}: ${text.slice(0, 300)}`);
  }
}

async function sendEmailMessage(
  settings: NonNullable<Settings>,
  to: string,
  subject: string,
  body: string,
): Promise<void> {
  if (settings.emailProvider !== EmailProvider.RESEND) {
    // SMTP requires a different runtime dependency (nodemailer) and is not
    // wired up in this build — admins should pick Resend for now.
    throw new Error("Only the Resend email provider is supported in this build.");
  }
  if (!settings.emailApiKey || !settings.emailFromAddress) {
    throw new Error("Email credentials missing.");
  }
  const from = settings.emailFromName
    ? `${settings.emailFromName} <${settings.emailFromAddress}>`
    : settings.emailFromAddress;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.emailApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: body,
      // Render newlines as <br> for a readable HTML version too.
      html: body
        .split("\n")
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join(""),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend API ${res.status}: ${text.slice(0, 300)}`);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
