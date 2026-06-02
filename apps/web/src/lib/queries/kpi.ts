import { OrderStatus } from "@crm-tool/db";
import { auth } from "@crm-tool/auth";
import { headers } from "next/headers";

import { prisma } from "@/lib/db";
import { watCurrentWeekRange } from "@/components/ops/wat";

/**
 * KPI Board read model (Module J, KPI-01..04).
 *
 * A KPI row carries a manual `currentValue` UNLESS it is `autoComputed`, in
 * which case the actual is derived on load (SPEC §Q6):
 *   - "completed jobs this week" → count Orders COMPLETED in the current WAT week
 *   - "avg customer rating"      → avg of all Feedback.rating
 *
 * Auto-source matching is by a stable `autoSource` key embedded in the KPI
 * name (case-insensitive keyword match), so that no schema change is needed and
 * admins can still create such KPIs from the UI by name.
 */

import {
  type AutoSource,
  type KpiView,
  type KpiVoteSummary,
  detectAutoSource,
} from "./kpi-shared";

// Re-exported so server-side importers (e.g. actions/kpi.ts) keep a single
// import site. Client components import these from `./kpi-shared` directly to
// avoid pulling Prisma into the browser bundle.
export { detectAutoSource };
export type { AutoSource, KpiView };

function progress(actual: number | null, target: number): number | null {
  if (actual === null || !Number.isFinite(target) || target <= 0) return null;
  const pct = (actual / target) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/** Count of Orders COMPLETED within the current WAT week. */
async function completedJobsThisWeek(): Promise<number> {
  const { start, end } = watCurrentWeekRange();
  return prisma.order.count({
    where: {
      status: OrderStatus.COMPLETED,
      // Completed "this week" is approximated by updatedAt falling in the week
      // window (status transitions touch updatedAt; receivedDate would miss
      // jobs taken in earlier weeks but completed now).
      updatedAt: { gte: start, lt: end },
    },
  });
}

/** Average of all Feedback ratings (1..5), or null when there is none. */
async function avgCustomerRating(): Promise<number | null> {
  const agg = await prisma.feedback.aggregate({ _avg: { rating: true } });
  const avg = agg._avg.rating;
  return avg === null || avg === undefined ? null : Math.round(avg * 100) / 100;
}

/**
 * Loads the KPI board: every CompanyKPI with its actual-vs-target resolved.
 * Auto-computed actuals are filled per row; manual rows use stored currentValue.
 */
export async function getKpiBoard(): Promise<KpiView[]> {
  const kpis = await prisma.companyKPI.findMany({
    orderBy: [{ periodEnd: "desc" }, { name: "asc" }],
  });

  // Compute the shared auto-sources once (only when needed).
  const needsCompleted = kpis.some(
    (k) => k.autoComputed && detectAutoSource(k.name) === "completed_jobs_week",
  );
  const needsRating = kpis.some(
    (k) => k.autoComputed && detectAutoSource(k.name) === "avg_rating",
  );

  const session = await auth.api.getSession({ headers: await headers() });
  const viewerId = (session?.user as { id?: string } | undefined)?.id ?? null;

  const [completed, rating, voteSummaries] = await Promise.all([
    needsCompleted ? completedJobsThisWeek() : Promise.resolve(null),
    needsRating ? avgCustomerRating() : Promise.resolve(null),
    voteSummariesByKpi(
      kpis.map((k) => k.id),
      viewerId,
    ),
  ]);

  return kpis.map((k) => {
    const autoSource = k.autoComputed ? detectAutoSource(k.name) : null;
    let actualValue: number | null = k.currentValue ?? null;
    if (autoSource === "completed_jobs_week") actualValue = completed;
    else if (autoSource === "avg_rating") actualValue = rating;

    return {
      id: k.id,
      name: k.name,
      category: k.category ?? null,
      targetValue: k.targetValue,
      actualValue,
      unit: k.unit ?? null,
      periodStart: k.periodStart.toISOString(),
      periodEnd: k.periodEnd.toISOString(),
      autoComputed: k.autoComputed,
      autoSource,
      progressPct: progress(actualValue, k.targetValue),
      votes: voteSummaries.get(k.id) ?? { count: 0, average: null, myRating: null },
    };
  });
}

/**
 * Loads `{ count, average, myRating }` per KPI in a single round-trip:
 *   - one `groupBy` for aggregates over all voters,
 *   - one `findMany` for the current viewer's own votes (skipped if signed out).
 */
async function voteSummariesByKpi(
  kpiIds: string[],
  viewerId: string | null,
): Promise<Map<string, KpiVoteSummary>> {
  const result = new Map<string, KpiVoteSummary>();
  if (kpiIds.length === 0) return result;

  const [groups, mine] = await Promise.all([
    prisma.kpiVote.groupBy({
      by: ["kpiId"],
      where: { kpiId: { in: kpiIds } },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    viewerId
      ? prisma.kpiVote.findMany({
          where: { kpiId: { in: kpiIds }, userId: viewerId },
          select: { kpiId: true, rating: true },
        })
      : Promise.resolve([] as { kpiId: string; rating: number }[]),
  ]);

  const myByKpi = new Map(mine.map((v) => [v.kpiId, v.rating]));
  for (const g of groups) {
    const avg = g._avg.rating;
    result.set(g.kpiId, {
      count: g._count._all,
      average: avg === null || avg === undefined ? null : Math.round(avg * 100) / 100,
      myRating: myByKpi.get(g.kpiId) ?? null,
    });
  }
  // Make sure KPIs with no votes still get an entry with the viewer's null.
  for (const id of kpiIds) {
    if (!result.has(id)) {
      result.set(id, { count: 0, average: null, myRating: myByKpi.get(id) ?? null });
    }
  }
  return result;
}
