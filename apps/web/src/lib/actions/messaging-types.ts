/**
 * Shared types for the messaging server actions and dialogs.
 *
 * Lives outside `messaging.ts` (which carries `"use server"`) so the client
 * components can import the type definitions without pulling the server
 * runtime into their bundles.
 */

import type {
  BulkRecipientState,
  Channel,
  ClientStatus,
  EmailProvider,
} from "@crm-tool/db/enums";

export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

/** Public view of the messaging settings — never includes secrets. */
export interface MessagingSettingsView {
  whatsapp: {
    enabled: boolean;
    phoneNumberId: string | null;
    businessNumber: string | null;
    displayName: string | null;
    hasAccessToken: boolean;
  };
  email: {
    enabled: boolean;
    provider: EmailProvider | null;
    fromName: string | null;
    fromAddress: string | null;
    hasApiKey: boolean;
    smtpHost: string | null;
    smtpPort: number | null;
    smtpUser: string | null;
    smtpSecure: boolean | null;
    hasSmtpPassword: boolean;
  };
  updatedAt: string | null;
}

export interface WhatsappSettingsInput {
  enabled: boolean;
  phoneNumberId: string;
  accessToken?: string; // optional on update — empty keeps existing
  businessNumber?: string;
  displayName?: string;
}

export interface EmailSettingsInput {
  enabled: boolean;
  provider: EmailProvider;
  fromName: string;
  fromAddress: string;
  apiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpSecure?: boolean;
}

/** Selection mode for the bulk-send dialog. */
export type BulkAudience =
  | { mode: "all" }
  | { mode: "selected"; clientIds: string[] };

export interface BulkSendInput {
  channel: Channel;
  subject?: string; // email only
  /** Template body. Supports `{{name}}`, `{{firstName}}`, `{{phone}}`, `{{email}}`,
   *  `{{whatsapp}}`, `{{vehicle}}` placeholders. */
  content: string;
  audience: BulkAudience;
  /** Optional client-status whitelist applied after the audience is resolved.
   *  Empty / undefined means no filter. */
  statusFilter?: ClientStatus[];
  /** Send a single test message to this destination only — does not record a campaign. */
  testDestination?: string;
}

/** Aggregated result of a bulk send. */
export interface BulkSendResult {
  bulkMessageId: string | null;
  sent: number;
  failed: number;
  skipped: number;
  /** Optional per-recipient diagnostics (first 20). */
  details: BulkRecipientResult[];
}

export interface BulkRecipientResult {
  clientId: string;
  clientName: string;
  destination: string;
  state: BulkRecipientState;
  error?: string;
}

/** Lightweight client option for the bulk-send dialog. */
export interface BulkClientOption {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  status: ClientStatus;
}
