import { auth } from "@crm-tool/auth";
import type { Role } from "@crm-tool/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ReportView } from "@/components/reports/report-view";
import { getMonthlyReport, reportToPlainText } from "@/lib/queries/reports";
import { can } from "@/lib/rbac";

interface SearchParams {
  year?: string;
  month?: string;
}

/**
 * Shared monthly report. Visible to every authenticated user (matches the
 * dashboard view rules). The page is a server component — it computes the
 * report on the server and ships it to a client component that renders the
 * tabs and exposes the download / email share actions.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const now = new Date();
  const year = Number.parseInt(params.year ?? "", 10) || now.getUTCFullYear();
  const month = Number.parseInt(params.month ?? "", 10) || now.getUTCMonth() + 1;

  const safeMonth = Math.min(12, Math.max(1, month));
  const report = await getMonthlyReport(year, safeMonth);
  const plainText = reportToPlainText(report);

  // Build a 12-month picker for the current and previous calendar year.
  const monthOptions = buildMonthOptions(now);

  const roles = ((session.user as { roles?: Role[] }).roles ?? []) as Role[];
  const canClearActivity = can(roles, "manage_users");

  return (
    <ReportView
      report={{
        ...report,
        // Dates must cross the server→client boundary as ISO strings.
        monthStart: report.monthStart.toISOString(),
        monthEnd: report.monthEnd.toISOString(),
        weeks: report.weeks.map((w) => ({
          ...w,
          start: w.start.toISOString(),
          end: w.end.toISOString(),
        })),
      }}
      monthOptions={monthOptions}
      plainText={plainText}
      currentUserEmail={session.user.email}
      currentUserId={session.user.id}
      canClearActivity={canClearActivity}
    />
  );
}

function buildMonthOptions(now: Date): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    out.push({ value: `${y}-${m}`, label: `${names[m - 1]} ${y}` });
  }
  return out;
}
