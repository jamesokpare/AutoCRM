"use server";

import { auth } from "@crm-tool/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { withMutation } from "@/lib/mutation";
import { PermissionError, requirePermission, type SessionLike } from "@/lib/rbac";
import { currentCycle } from "@/lib/queries/reviews";
import type { SubmitReviewInput, SubmitReviewResult } from "./reviews-types";

interface SessionUserShape {
  id: string;
  roles?: string[] | null;
  isApproved?: boolean | null;
}

function sessionLike(user: SessionUserShape): SessionLike {
  return { user: { roles: user.roles, isApproved: user.isApproved } };
}

function clampScore(n: unknown): number | null {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v) || v < 1 || v > 5) return null;
  return v;
}

function cleanExtra(extra: Record<string, number> | null | undefined): Record<string, number> | null {
  if (!extra) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(extra)) {
    const score = clampScore(v);
    const key = k.trim();
    if (key && score !== null) out[key] = score;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * PERF-01/02/03: submit (or update) a peer review. Everyone with
 * `grade_performance` (all roles) may grade everyone. Respects the unique
 * [reviewerId, revieweeId, cycle] constraint via upsert so re-grading the same
 * person in the same cycle edits the existing review rather than failing.
 */
export async function submitReview(input: SubmitReviewInput): Promise<SubmitReviewResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user as SessionUserShape | undefined;
  try {
    if (!user) throw new PermissionError("UNAUTHENTICATED", "You must be signed in.");
    requirePermission(sessionLike(user), "grade_performance");

    if (!input.revieweeId) return { ok: false, error: "Missing reviewee." };
    if (input.revieweeId === user.id) {
      return { ok: false, error: "You cannot review yourself." };
    }

    const deliverablesScore = clampScore(input.deliverablesScore);
    const communicationScore = clampScore(input.communicationScore);
    if (deliverablesScore === null || communicationScore === null) {
      return { ok: false, error: "Scores must be between 1 and 5." };
    }

    const cycle = input.cycle?.trim() || currentCycle();
    const comments = input.comments?.trim() || null;
    const extraScores = cleanExtra(input.extraScores);

    const review = await withMutation(
      {
        entityType: "PerformanceReview",
        action: "submitted",
        userId: user.id,
        metadata: { revieweeId: input.revieweeId, cycle },
      },
      async () =>
        prisma.performanceReview.upsert({
          where: {
            reviewerId_revieweeId_cycle: {
              reviewerId: user.id,
              revieweeId: input.revieweeId,
              cycle,
            },
          },
          create: {
            reviewerId: user.id,
            revieweeId: input.revieweeId,
            cycle,
            deliverablesScore,
            communicationScore,
            comments,
            extraScores: extraScores ?? undefined,
          },
          update: {
            deliverablesScore,
            communicationScore,
            comments,
            extraScores: extraScores ?? undefined,
          },
        }),
      (created) => created.id,
    );

    revalidatePath("/reviews");
    revalidatePath("/profile");
    return { ok: true, reviewId: review.id };
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}
