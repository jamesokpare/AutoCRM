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

  // Don't let a DB error (e.g. the Attendance table missing because the prod
  // schema hasn't been pushed) crash the whole route. Render an empty panel
  // with a banner instead so the user can still see *something*.
  let rows: Awaited<ReturnType<typeof getTodayAttendance>> = [];
  let initiallyClockedIn = false;
  let loadError: string | null = null;
  try {
    const [r, open] = await Promise.all([
      getTodayAttendance(),
      getMyOpenAttendance(session.user.id),
    ]);
    rows = r;
    initiallyClockedIn = open !== null;
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load attendance.";
  }

  return (
    <AttendancePanel
      initialRows={rows}
      currentUserId={session.user.id}
      initiallyClockedIn={initiallyClockedIn}
      loadError={loadError}
    />
  );
}
