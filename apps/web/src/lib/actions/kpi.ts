"use server";

import { auth } from "@crm-tool/auth";
import type { Role } from "@crm-tool/db";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { withMutation } from "@/lib/mutation";
import { PermissionError, requirePermission } from "@/lib/rbac";
import { detectAutoSource, getKpiBoard, type KpiView } from "@/lib/queries/kpi";
import type { ActionResult, KpiInput } from "./kpi-types";

/**
 * Company KPI board mutations (Module J, KPI-01..04).
 *
 * Setting / editing targets requires the `set_kpi_targets` capability
 * (Admin/Manager — SPEC §5). All writes route through `withMutation` so an
 * ActivityLog row + the (no-op) domain-event seam fire uniformly.
 */

interface SessionUser {
  id: string;
  roles?: Role[] | null;
  isApproved?: boolean | null;
}

async function requireKpiEditor(): Promise<SessionUser> {
  const session = await auth.api.getSession({ headers: await headers() });
  requirePermission(
    session
      ? {
          user: {
            roles: (session.user as SessionUser).roles,
            isApproved: (session.user as SessionUser).isApproved,
          },
        }
      : null,
    "set_kpi_targets",
  );
  return session!.user as SessionUser;
}

function validate(input: KpiInput): string | null {
  if (!input.name?.trim()) return "Name is required.";
  if (!Number.isFinite(input.targetValue)) return "Target value must be a number.";
  const start = new Date(input.periodStart);
  const end = new Date(input.periodEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Period start and end must be valid dates.";
  }
  if (end.getTime() < start.getTime()) return "Period end must be after period start.";
  // Auto-computed KPIs must map to a known source.
  if (input.autoComputed && detectAutoSource(input.name) === null) {
    return "Auto-computed KPIs must reference a known source (completed jobs or rating) in the name.";
  }
  return null;
}

function mapError(e: unknown): ActionResult {
  if (e instanceof PermissionError) return { ok: false, error: e.message };
  return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
}

/**
 * Read the KPI board (client-callable server action for TanStack Query
 * focus-refetch). VIEW is open to all authenticated users (SPEC §5) — the
 * dashboard layout already guards the route.
 */
export async function fetchKpiBoard(): Promise<KpiView[]> {
  return getKpiBoard();
}

/** KPI-01: create a company-wide KPI target. */
export async function createKpi(input: KpiInput): Promise<ActionResult> {
  try {
    const user = await requireKpiEditor();
    const invalid = validate(input);
    if (invalid) return { ok: false, error: invalid };

    const auto = input.autoComputed ?? false;
    const created = await withMutation(
      { entityType: "CompanyKPI", action: "created", userId: user.id },
      async () =>
        prisma.companyKPI.create({
          data: {
            name: input.name.trim(),
            targetValue: input.targetValue,
            currentValue: auto ? null : (input.currentValue ?? null),
            unit: input.unit?.trim() || null,
            periodStart: new Date(input.periodStart),
            periodEnd: new Date(input.periodEnd),
            autoComputed: auto,
          },
        }),
      (k) => k.id,
    );
    revalidatePath("/kpi");
    return { ok: true, id: created.id };
  } catch (e) {
    return mapError(e);
  }
}

/** KPI-04: edit an existing KPI target / period / manual actual. */
export async function updateKpi(id: string, input: KpiInput): Promise<ActionResult> {
  try {
    const user = await requireKpiEditor();
    const invalid = validate(input);
    if (invalid) return { ok: false, error: invalid };

    const auto = input.autoComputed ?? false;
    await withMutation(
      { entityType: "CompanyKPI", action: "updated", userId: user.id, entityId: id },
      async () =>
        prisma.companyKPI.update({
          where: { id },
          data: {
            name: input.name.trim(),
            targetValue: input.targetValue,
            currentValue: auto ? null : (input.currentValue ?? null),
            unit: input.unit?.trim() || null,
            periodStart: new Date(input.periodStart),
            periodEnd: new Date(input.periodEnd),
            autoComputed: auto,
          },
        }),
    );
    revalidatePath("/kpi");
    return { ok: true, id };
  } catch (e) {
    return mapError(e);
  }
}

/** Delete a KPI target. */
export async function deleteKpi(id: string): Promise<ActionResult> {
  try {
    const user = await requireKpiEditor();
    await withMutation(
      { entityType: "CompanyKPI", action: "deleted", userId: user.id, entityId: id },
      async () => prisma.companyKPI.delete({ where: { id } }),
    );
    revalidatePath("/kpi");
    return { ok: true, id };
  } catch (e) {
    return mapError(e);
  }
}
