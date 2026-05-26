/**
 * Shared types for performance review server actions.
 *
 * These live OUTSIDE `reviews.ts` because that file carries the `"use server"`
 * directive, and a server-action module may only export async functions.
 * Exporting types from it breaks the server-action boundary and pulls the
 * server-only Prisma client into client bundles.
 */

export interface SubmitReviewResult {
  ok: boolean;
  error?: string;
  reviewId?: string;
}

export interface SubmitReviewInput {
  revieweeId: string;
  /** Defaults to the current ISO-week cycle. */
  cycle?: string;
  deliverablesScore: number;
  communicationScore: number;
  comments?: string | null;
  /** PERF-02: configurable extra criteria → stored in the JSON field. */
  extraScores?: Record<string, number> | null;
}
