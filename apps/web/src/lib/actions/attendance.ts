"use server";

import { auth } from "@crm-tool/auth";
import { NotificationType } from "@crm-tool/db";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { withMutation } from "@/lib/mutation";
import { createNotification } from "@/lib/notifications";
import {
  type AttendanceRow,
  getMyOpenAttendance,
  getTodayAttendance,
} from "@/lib/queries/attendance";
import { getTodayTaskSummary, type TodayTaskSummary } from "@/lib/queries/tasks";
import { PermissionError, requireAuth } from "@/lib/rbac";
import type { ActionResult } from "./attendance-types";

/**
 * Attendance — clock in / clock out, open to every authenticated team member.
 * Records route through `withMutation` for a uniform ActivityLog entry.
 *
 * Side-effect on transitions: we write a pull-based `Notification` row that
 * nudges the user to check today's tasks (on clock-in) or to verify they
 * finished them (on clock-out). The UI also surfaces the same message inline
 * via a toast so the user sees it immediately.
 */

interface SessionUser {
  id: string;
}

async function requireUser(): Promise<SessionUser> {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user as SessionUser | undefined;
  requireAuth(user ? { user } : null);
  return user!;
}

function fail(err: unknown): ActionResult {
  if (err instanceof PermissionError) return { ok: false, error: err.message };
  if (err instanceof Error) return { ok: false, error: err.message };
  return { ok: false, error: "Something went wrong." };
}

function clockInReminder(summary: TodayTaskSummary): string {
  if (summary.total === 0) {
    return "You're clocked in. No tasks on your board yet — head to Tasks if you need to plan your day.";
  }
  const remaining = summary.pending + summary.inProgress;
  if (remaining === 0) {
    return `You're clocked in. All ${summary.total} of today's tasks are already wrapped up — nice.`;
  }
  return `You're clocked in. Check your tasks for today — ${remaining} of ${summary.total} still need attention.`;
}

function clockOutReminder(summary: TodayTaskSummary): string {
  if (summary.total === 0) {
    return "Clocked out. No tasks were tracked for today.";
  }
  const remaining = summary.pending + summary.inProgress;
  if (remaining === 0) {
    return `Clocked out. All ${summary.total} of today's tasks done — great work.`;
  }
  return `Clocked out. ${remaining} of ${summary.total} task${
    summary.total === 1 ? "" : "s"
  } still open — review your day before you head off.`;
}

/** Read today's team attendance (client-callable for TanStack Query refetch). */
export async function fetchTodayAttendance(): Promise<AttendanceRow[]> {
  return getTodayAttendance();
}

/** Start a new attendance record for the current user. */
export async function clockIn(): Promise<ActionResult> {
  try {
    const user = await requireUser();

    const open = await getMyOpenAttendance(user.id);
    if (open) return { ok: false, error: "You are already clocked in." };

    await withMutation(
      { entityType: "Attendance", action: "clock_in", userId: user.id },
      async () => prisma.attendance.create({ data: { userId: user.id } }),
      (a) => a.id,
    );

    const summary = await getTodayTaskSummary(user.id);
    const reminder = clockInReminder(summary);
    await createNotification({
      userId: user.id,
      type: NotificationType.GENERIC,
      title: "Check your tasks for today",
      body: reminder,
      link: "/tasks",
    });

    revalidatePath("/attendance");
    return { ok: true, taskSummary: summary, reminder };
  } catch (err) {
    return fail(err);
  }
}

/** Close the current user's open attendance record. */
export async function clockOut(): Promise<ActionResult> {
  try {
    const user = await requireUser();

    const open = await getMyOpenAttendance(user.id);
    if (!open) return { ok: false, error: "You are not clocked in." };

    await withMutation(
      { entityType: "Attendance", action: "clock_out", userId: user.id, entityId: open.id },
      async () => prisma.attendance.update({ where: { id: open.id }, data: { clockOut: new Date() } }),
    );

    const summary = await getTodayTaskSummary(user.id);
    const reminder = clockOutReminder(summary);
    await createNotification({
      userId: user.id,
      type: NotificationType.GENERIC,
      title: "Did you finish today's tasks?",
      body: reminder,
      link: "/tasks",
    });

    revalidatePath("/attendance");
    return { ok: true, taskSummary: summary, reminder };
  } catch (err) {
    return fail(err);
  }
}
