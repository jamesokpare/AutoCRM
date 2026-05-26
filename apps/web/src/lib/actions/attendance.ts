"use server";

import { auth } from "@crm-tool/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { withMutation } from "@/lib/mutation";
import {
  type AttendanceRow,
  getMyOpenAttendance,
  getTodayAttendance,
} from "@/lib/queries/attendance";
import { PermissionError, requireAuth } from "@/lib/rbac";
import type { ActionResult } from "./attendance-types";

/**
 * Attendance — clock in / clock out, open to every authenticated team member.
 * Records route through `withMutation` for a uniform ActivityLog entry.
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

    revalidatePath("/attendance");
    return { ok: true };
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

    revalidatePath("/attendance");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}
