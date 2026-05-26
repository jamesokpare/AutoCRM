"use server";

import { auth } from "@crm-tool/auth";
import { ReminderState } from "@crm-tool/db";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { withMutation } from "@/lib/mutation";
import {
  getMyReminderCentre,
  getTeamReminderCentre,
  type ReminderCentre,
} from "@/lib/queries/reminders";
import type { ActionResult, CreateReminderInput } from "./reminders-types";

/**
 * Reminder mutations (REM-06).
 *
 * REM-06 says "users can create one-off or recurring reminders" — there is no
 * dedicated capability in the RBAC matrix (SPEC §5), so creation/transition is
 * open to any authenticated + APPROVED user (unapproved = read-only per
 * AUTH-05). All writes route through `withMutation`.
 */

interface SessionUser {
  id: string;
}

class ReminderAuthError extends Error {}

async function requireUser(): Promise<SessionUser> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new ReminderAuthError("You must be signed in.");
  return session.user as SessionUser;
}

function mapError(e: unknown): ActionResult {
  if (e instanceof ReminderAuthError) return { ok: false, error: e.message };
  return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
}

/**
 * Client-callable read of the reminder centre for TanStack focus-refetch.
 * `scope`:
 *   - "mine": reminders assigned to the caller
 *   - "team": all PENDING reminders (VIEW open to all — SPEC §5)
 * Recomputes overdue/today/upcoming in WAT on each call.
 */
export async function fetchReminderCentre(scope: "mine" | "team"): Promise<ReminderCentre> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { overdue: [], today: [], upcoming: [] };
  if (scope === "team") return getTeamReminderCentre();
  return getMyReminderCentre((session.user as SessionUser).id);
}

/** REM-06: create a one-off or recurring reminder on an order or client. */
export async function createReminder(input: CreateReminderInput): Promise<ActionResult> {
  try {
    const user = await requireUser();

    const due = new Date(input.dueAt);
    if (Number.isNaN(due.getTime())) return { ok: false, error: "Due date is invalid." };
    if (input.orderId && input.clientId) {
      return { ok: false, error: "Attach a reminder to an order OR a client, not both." };
    }

    const created = await withMutation(
      { entityType: "Reminder", action: "created", userId: user.id },
      async () =>
        prisma.reminder.create({
          data: {
            type: input.type,
            orderId: input.orderId || null,
            clientId: input.clientId || null,
            dueAt: due,
            recurrence: input.recurrence?.trim() || null,
            assigneeId: input.assigneeId || null,
            state: ReminderState.PENDING,
          },
        }),
      (r) => r.id,
    );
    revalidatePath("/reminders");
    return { ok: true, id: created.id };
  } catch (e) {
    return mapError(e);
  }
}

/** REM-06: mark a reminder done (PENDING → DONE). */
export async function completeReminder(id: string): Promise<ActionResult> {
  return transition(id, ReminderState.DONE, "completed");
}

/** REM-06: dismiss a reminder (PENDING → DISMISSED). */
export async function dismissReminder(id: string): Promise<ActionResult> {
  return transition(id, ReminderState.DISMISSED, "dismissed");
}

async function transition(
  id: string,
  next: ReminderState,
  action: string,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await withMutation(
      { entityType: "Reminder", action, userId: user.id, entityId: id },
      async () => prisma.reminder.update({ where: { id }, data: { state: next } }),
    );
    revalidatePath("/reminders");
    return { ok: true, id };
  } catch (e) {
    return mapError(e);
  }
}
