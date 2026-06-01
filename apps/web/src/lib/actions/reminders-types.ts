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
  /** When a batch create runs, the number of reminder rows actually created. */
  count?: number;
}

export interface CreateReminderInput {
  type: ReminderType;
  /** Attach to exactly one of order or client (or neither for a general reminder). */
  orderId?: string | null;
  clientId?: string | null;
  /**
   * One or more ISO UTC instants the reminder should fire at (the form converts
   * WAT wall-clock → UTC before sending). At least one entry is required. When
   * multiple are supplied, the action creates one `Reminder` row per entry so
   * the centre can list them independently.
   */
  dueAts: string[];
  /** Free-form recurrence label, e.g. "weekly" (no scheduler this phase). */
  recurrence?: string | null;
  /**
   * Intra-day frequency in minutes. When set, indicates the user wants the
   * reminder to repeat every N minutes during the day. Stored on each row's
   * `recurrence` column as `every Nm` so the centre can render it; the form
   * also uses it as a generator (start + end + frequency → multiple `dueAts`).
   */
  frequencyMinutes?: number | null;
  assigneeId?: string | null;
}
