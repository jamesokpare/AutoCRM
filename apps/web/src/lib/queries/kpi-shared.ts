/**
 * Client-safe KPI types + pure helpers (no Prisma).
 *
 * `queries/kpi.ts` imports Prisma, so client components must not import value
 * exports from it. The pure `detectAutoSource` helper and the view types live
 * here so both server queries and client forms can use them without dragging
 * the DB client into the browser bundle.
 */

export type AutoSource = "completed_jobs_week" | "avg_rating" | null;

export interface KpiView {
  id: string;
  name: string;
  targetValue: number;
  /** Effective actual: computed when autoComputed, else the stored manual value. */
  actualValue: number | null;
  unit: string | null;
  periodStart: string; // ISO
  periodEnd: string; // ISO
  autoComputed: boolean;
  autoSource: AutoSource;
  /** 0..100, clamped; null when no actual is available. */
  progressPct: number | null;
}

/**
 * Detects which auto-source a KPI name maps to. Returns null for manual KPIs.
 * Matching is intentionally forgiving so the seeded/auto KPIs resolve.
 */
export function detectAutoSource(name: string): AutoSource {
  const n = name.toLowerCase();
  if (n.includes("complet") && (n.includes("job") || n.includes("order"))) {
    return "completed_jobs_week";
  }
  if (n.includes("rating") || n.includes("csat") || n.includes("satisfaction")) {
    return "avg_rating";
  }
  return null;
}
