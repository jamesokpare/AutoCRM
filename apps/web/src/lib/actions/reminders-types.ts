import type { ReminderType } from "@crm-tool/db";

/**
 * Shared types for reminder server actions.
 *
 * These live OUTSIDE `reminders.ts` because that file carries the `"use server"`
 * directive, and a server-action module may only export async functions.
 * Exporting types from it breaks the server-action boundary and pulls the
 * server-only Prisma client into client bundles.
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

export interface CreateReminderInput {
  type: ReminderType;
  /** Attach to exactly one of order or client (or neither for a general reminder). */
  orderId?: string | null;
  clientId?: string | null;
  /** ISO UTC instant (the form converts WAT wall-clock → UTC before sending). */
  dueAt: string;
  /** Free-form recurrence label, e.g. "weekly" (no scheduler this phase). */
  recurrence?: string | null;
  assigneeId?: string | null;
}
