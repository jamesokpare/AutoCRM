/**
 * Client-safe KPI types + pure helpers (no Prisma).
 *
 * `queries/kpi.ts` imports Prisma, so client components must not import value
 * exports from it. The pure `detectAutoSource` helper and the view types live
 * here so both server queries and client forms can use them without dragging
 * the DB client into the browser bundle.
 */

export type AutoSource = "completed_jobs_week" | "avg_rating" | null;

/**
 * Suggested KPI categories surfaced in the create/edit form. Free-form strings
 * are still allowed (the field is `String?` in the schema) — these are just the
 * defaults so naming stays consistent across the board.
 */
export const KPI_CATEGORY_SUGGESTIONS = [
  "Customer Service",
  "Engineering",
  "Product",
  "Operations",
  "Procurement",
  "Mechanics",
] as const;

export type KpiCategorySuggestion = (typeof KPI_CATEGORY_SUGGESTIONS)[number];

/** Label used in grouped views for KPIs that don't have a category set. */
export const KPI_UNCATEGORISED_LABEL = "Uncategorised";

export interface KpiView {
  id: string;
  name: string;
  /** Free-form category label, e.g. "Customer Service". Null = uncategorised. */
  category: string | null;
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
