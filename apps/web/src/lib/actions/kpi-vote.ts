"use server";

import { auth } from "@crm-tool/auth";
import type { Role } from "@crm-tool/db";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { withMutation } from "@/lib/mutation";
import { PermissionError, requireAuth } from "@/lib/rbac";
import type { ActionResult } from "./kpi-types";

/**
 * KPI voting: every authenticated team member can rate any KPI 1..5. Votes are
 * upserted on `(kpiId, userId)`, so re-voting updates the rating in place.
 * Writes flow through `withMutation` for the usual audit-log + domain-event
 * seam.
 */

interface SessionUser {
  id: string;
  roles?: Role[] | null;
  isApproved?: boolean | null;
}

async function requireVoter(): Promise<SessionUser> {
  const session = await auth.api.getSession({ headers: await headers() });
  requireAuth(session ? { user: session.user as SessionUser } : null);
  return session!.user as SessionUser;
}

function mapError(e: unknown): ActionResult {
  if (e instanceof PermissionError) return { ok: false, error: e.message };
  return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
}

/** Cast or update the caller's vote on `kpiId`. `rating` must be 1..5. */
export async function voteKpi(kpiId: string, rating: number): Promise<ActionResult> {
  try {
    const user = await requireVoter();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return { ok: false, error: "Rating must be an integer from 1 to 5." };
    }

    const existing = await prisma.kpiVote.findUnique({
      where: { kpiId_userId: { kpiId, userId: user.id } },
      select: { id: true },
    });

    const saved = await withMutation(
      {
        entityType: "KpiVote",
        action: existing ? "updated" : "created",
        userId: user.id,
        metadata: { kpiId, rating },
      },
      async () =>
        prisma.kpiVote.upsert({
          where: { kpiId_userId: { kpiId, userId: user.id } },
          create: { kpiId, userId: user.id, rating },
          update: { rating },
        }),
      (v) => v.id,
    );

    revalidatePath("/kpi");
    return { ok: true, id: saved.id };
  } catch (e) {
    return mapError(e);
  }
}

/** Remove the caller's vote on `kpiId` (no-op if they never voted). */
export async function clearKpiVote(kpiId: string): Promise<ActionResult> {
  try {
    const user = await requireVoter();

    const existing = await prisma.kpiVote.findUnique({
      where: { kpiId_userId: { kpiId, userId: user.id } },
      select: { id: true },
    });
    if (!existing) return { ok: true };

    await withMutation(
      {
        entityType: "KpiVote",
        action: "deleted",
        userId: user.id,
        entityId: existing.id,
        metadata: { kpiId },
      },
      async () => prisma.kpiVote.delete({ where: { id: existing.id } }),
    );

    revalidatePath("/kpi");
    return { ok: true, id: existing.id };
  } catch (e) {
    return mapError(e);
  }
}
