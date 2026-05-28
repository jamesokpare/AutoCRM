import { auth } from "@crm-tool/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { getMonthlyReport, reportToCSV } from "@/lib/queries/reports";

/**
 * CSV download of the monthly employee + client activity summary. Every
 * authenticated user can fetch this — read-only, no role gate (matches the
 * shared dashboard view rules).
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const now = new Date();
  const year = Number.parseInt(url.searchParams.get("year") ?? "", 10) || now.getUTCFullYear();
  const month =
    Number.parseInt(url.searchParams.get("month") ?? "", 10) || now.getUTCMonth() + 1;

  if (month < 1 || month > 12) {
    return new NextResponse("Invalid month", { status: 400 });
  }

  const report = await getMonthlyReport(year, month);
  const csv = reportToCSV(report);
  const filename = `activity-${year}-${String(month).padStart(2, "0")}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
