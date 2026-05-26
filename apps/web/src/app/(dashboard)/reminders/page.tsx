import { auth } from "@crm-tool/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ReminderCentreView } from "@/components/ops/reminder-centre";
import {
  getMyReminderCentre,
  getReminderTargets,
  getTeamReminderCentre,
} from "@/lib/queries/reminders";

/**
 * Reminders CENTRE (REM-06 / REM-08). Lists everything due today, overdue and
 * upcoming — both "assigned to me" and team-wide — computed on load in WAT.
 * VIEW is open to all authenticated users (layout guards auth).
 */
export default async function RemindersPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const [mine, team, targets] = await Promise.all([
    getMyReminderCentre(session.user.id),
    getTeamReminderCentre(),
    getReminderTargets(),
  ]);

  return <ReminderCentreView initialMine={mine} initialTeam={team} targets={targets} />;
}
