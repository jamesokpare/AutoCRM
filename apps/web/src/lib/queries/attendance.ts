import { prisma } from "@/lib/db";
import { watStartOfDay, watStartOfNextDay } from "@/components/ops/wat";

/** A single attendance (clock-in/out) record for display. */
export interface AttendanceRow {
  id: string;
  userId: string;
  userName: string;
  clockIn: Date;
  clockOut: Date | null;
}

/**
 * Today's attendance (WAT calendar day) for the WHOLE team, newest clock-in
 * first. Visible to everyone so the team can see who clocked in / out and when.
 */
export async function getTodayAttendance(now: Date = new Date()): Promise<AttendanceRow[]> {
  const start = watStartOfDay(now);
  const end = watStartOfNextDay(now);
  const rows = await prisma.attendance.findMany({
    where: { clockIn: { gte: start, lt: end } },
    orderBy: { clockIn: "desc" },
    include: { user: { select: { id: true, name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userName: r.user.name,
    clockIn: r.clockIn,
    clockOut: r.clockOut,
  }));
}

/**
 * The current user's open (not-yet-clocked-out) record, if any. Used to decide
 * whether to show "Clock in" or "Clock out".
 */
export async function getMyOpenAttendance(userId: string): Promise<AttendanceRow | null> {
  const row = await prisma.attendance.findFirst({
    where: { userId, clockOut: null },
    orderBy: { clockIn: "desc" },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    userName: row.user.name,
    clockIn: row.clockIn,
    clockOut: row.clockOut,
  };
}
