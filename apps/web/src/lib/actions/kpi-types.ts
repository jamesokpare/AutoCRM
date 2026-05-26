/**
 * Shared types for KPI board server actions.
 *
 * These live OUTSIDE `kpi.ts` because that file carries the `"use server"`
 * directive, and a server-action module may only export async functions.
 * Exporting types from it breaks the server-action boundary and pulls the
 * server-only Prisma client into client bundles.
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

export interface KpiInput {
  name: string;
  targetValue: number;
  unit?: string | null;
  /** ISO strings (UTC) for the effective period. */
  periodStart: string;
  periodEnd: string;
  /** Manual actual; ignored for auto-computed KPIs. */
  currentValue?: number | null;
  autoComputed?: boolean;
}
