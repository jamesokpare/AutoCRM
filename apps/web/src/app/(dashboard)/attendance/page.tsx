import { auth } from "@crm-tool/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AttendancePanel } from "@/components/attendance/attendance-panel";
import { getMyOpenAttendance, getTodayAttendance } from "@/lib/queries/attendance";

/**
 * Attendance board. Every signed-in team member can clock in / out, and today's
 * attendance is visible to the whole team (route guarded by the dashboard
 * layout).
 */
export default async function AttendancePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const [rows, open] = await Promise.all([
    getTodayAttendance(),
    getMyOpenAttendance(session.user.id),
  ]);

  return (
    <AttendancePanel
      initialRows={rows}
      currentUserId={session.user.id}
      initiallyClockedIn={open !== null}
    />
  );
}
