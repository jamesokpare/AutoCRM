import type { Channel } from "@crm-tool/db";

/**
 * Shared types for the AI apology feature.
 *
 * These live OUTSIDE `ai.ts` because that file carries the `"use server"`
 * directive, and a server-action module may only export async functions.
 * Exporting types from it breaks the server-action boundary and pulls the
 * server-only Prisma client into client bundles. Client components import the
 * types from here; only the async actions come from `ai.ts`.
 */

export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

export type ApologyTone = "formal" | "warm" | "brief";

export interface DraftApologyInput {
  orderId: string;
  tone: ApologyTone;
  /** Delivery channel the draft is written for (SMS/WHATSAPP/EMAIL). */
  channel: Channel;
  /** Target language, e.g. "English". UI is English-only this phase (Q7). */
  language?: string;
}
