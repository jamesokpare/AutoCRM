import { Role } from "@crm-tool/db";

import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";

/**
 * Peer performance review read models (PERF-01..05).
 *
 * Visibility (SPEC §9 / PERF-05 decision): reviews are ATTRIBUTED.
 *  - Admin / Manager and the reviewee themselves may see INDIVIDUAL scores
 *    (incl. reviewer identity + comments).
 *  - Everyone else sees AGGREGATES ONLY (averages + trend, no per-review rows).
 * This is enforced here in the query layer (`canSeeIndividual`) so the UI can
 * never accidentally leak attributed rows.
 */

/** ISO-week cycle string, e.g. "2026-W21" (PERF helper). */
export function currentCycle(ref: Date = new Date()): string {
  const d = new Date(Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate()));
  // ISO week: Thursday-based.
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week =
    1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Whether `roles` (the viewer) may see individual attributed scores for `revieweeId`. */
export function canSeeIndividual(
  viewer: { id: string; roles: Role[] },
  revieweeId: string,
): boolean {
  if (viewer.id === revieweeId) return true; // the reviewee
  return (
    viewer.roles.includes(Role.ADMIN) ||
    viewer.roles.includes(Role.MANAGER) ||
    // any management capability implies privileged visibility
    can(viewer.roles, "manage_users")
  );
}

export interface ReviewPerson {
  id: string;
  name: string;
  photo: string | null;
}

export interface IndividualReview {
  id: string;
  cycle: string;
  reviewer: ReviewPerson;
  deliverablesScore: number;
  communicationScore: number;
  comments: string | null;
  extraScores: Record<string, number> | null;
  createdAt: Date;
}

export interface CriterionAverage {
  key: string;
  label: string;
  average: number;
  count: number;
}

export interface CycleTrendPoint {
  cycle: string;
  deliverables: number;
  communication: number;
  overall: number;
  count: number;
}

export interface RevieweeAggregate {
  reviewee: ReviewPerson;
  totalReviews: number;
  criteria: CriterionAverage[];
  trend: CycleTrendPoint[];
  /** Present only when the viewer is allowed individual visibility. */
  individual: IndividualReview[] | null;
}

const PERSON_SELECT = { id: true, name: true, photo: true } as const;

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function normalizeExtra(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object") return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * PERF-04: aggregates (per-criterion averages + per-cycle trend) for one
 * reviewee, and — only when the viewer is privileged — the attributed
 * individual reviews.
 */
export async function getRevieweeAggregate(
  viewer: { id: string; roles: Role[] },
  revieweeId: string,
): Promise<RevieweeAggregate | null> {
  const reviewee = await prisma.user.findUnique({
    where: { id: revieweeId },
    select: PERSON_SELECT,
  });
  if (!reviewee) return null;

  const reviews = await prisma.performanceReview.findMany({
    where: { revieweeId },
    orderBy: { cycle: "asc" },
    select: {
      id: true,
      cycle: true,
      deliverablesScore: true,
      communicationScore: true,
      comments: true,
      extraScores: true,
      createdAt: true,
      reviewer: { select: PERSON_SELECT },
    },
  });

  // Per-criterion averages (core + any extra criteria seen across reviews).
  const deliverables = reviews.map((r) => r.deliverablesScore);
  const communication = reviews.map((r) => r.communicationScore);
  const extraBuckets = new Map<string, number[]>();
  for (const r of reviews) {
    const extra = normalizeExtra(r.extraScores);
    if (!extra) continue;
    for (const [k, v] of Object.entries(extra)) {
      const bucket = extraBuckets.get(k) ?? [];
      bucket.push(v);
      extraBuckets.set(k, bucket);
    }
  }

  const criteria: CriterionAverage[] = [
    { key: "deliverables", label: "Deliverables", average: avg(deliverables), count: deliverables.length },
    { key: "communication", label: "Communication", average: avg(communication), count: communication.length },
    ...[...extraBuckets.entries()].map(([key, vals]) => ({
      key: `extra:${key}`,
      label: key,
      average: avg(vals),
      count: vals.length,
    })),
  ];

  // Per-cycle trend.
  const byCycle = new Map<string, { d: number[]; c: number[] }>();
  for (const r of reviews) {
    const entry = byCycle.get(r.cycle) ?? { d: [], c: [] };
    entry.d.push(r.deliverablesScore);
    entry.c.push(r.communicationScore);
    byCycle.set(r.cycle, entry);
  }
  const trend: CycleTrendPoint[] = [...byCycle.entries()]
    .map(([cycle, e]) => {
      const deliverablesAvg = avg(e.d);
      const communicationAvg = avg(e.c);
      return {
        cycle,
        deliverables: deliverablesAvg,
        communication: communicationAvg,
        overall: avg([deliverablesAvg, communicationAvg]),
        count: e.d.length,
      };
    })
    .sort((a, b) => a.cycle.localeCompare(b.cycle));

  const individual: IndividualReview[] | null = canSeeIndividual(viewer, revieweeId)
    ? reviews.map((r) => ({
        id: r.id,
        cycle: r.cycle,
        reviewer: r.reviewer,
        deliverablesScore: r.deliverablesScore,
        communicationScore: r.communicationScore,
        comments: r.comments,
        extraScores: normalizeExtra(r.extraScores),
        createdAt: r.createdAt,
      }))
    : null;

  return {
    reviewee,
    totalReviews: reviews.length,
    criteria,
    trend,
    individual,
  };
}

/** Everyone the viewer can grade (all users except themselves). */
export async function listReviewableMembers(viewerId: string): Promise<ReviewPerson[]> {
  const users = await prisma.user.findMany({
    where: { id: { not: viewerId } },
    orderBy: { name: "asc" },
    select: PERSON_SELECT,
  });
  return users;
}

/** A single member's review summary card for the reviews index. */
export interface MemberReviewSummary {
  person: ReviewPerson;
  totalReviews: number;
  overall: number;
}

export async function listMemberSummaries(): Promise<MemberReviewSummary[]> {
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      ...PERSON_SELECT,
      reviewsReceived: {
        select: { deliverablesScore: true, communicationScore: true },
      },
    },
  });

  return users.map((u) => {
    const scores = u.reviewsReceived.flatMap((r) => [r.deliverablesScore, r.communicationScore]);
    return {
      person: { id: u.id, name: u.name, photo: u.photo },
      totalReviews: u.reviewsReceived.length,
      overall: avg(scores),
    };
  });
}

/** The viewer's own already-submitted review for a reviewee+cycle, if any. */
export async function getMyReviewFor(
  reviewerId: string,
  revieweeId: string,
  cycle: string,
): Promise<{ deliverablesScore: number; communicationScore: number; comments: string | null; extraScores: Record<string, number> | null } | null> {
  const existing = await prisma.performanceReview.findUnique({
    where: { reviewerId_revieweeId_cycle: { reviewerId, revieweeId, cycle } },
    select: {
      deliverablesScore: true,
      communicationScore: true,
      comments: true,
      extraScores: true,
    },
  });
  if (!existing) return null;
  return { ...existing, extraScores: normalizeExtra(existing.extraScores) };
}
