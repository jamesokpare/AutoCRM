/**
 * Shared types for attendance (clock-in/out) server actions.
 *
 * Kept OUTSIDE `attendance.ts` because that file carries the `"use server"`
 * directive, and a server-action module may only export async functions.
 */

import type { TodayTaskSummary } from "@/lib/queries/tasks";

export interface ActionResult {
  ok: boolean;
  error?: string;
  /**
   * Today's task counts for the acting user. Populated on a successful clock-in
   * (so the UI can remind the user what's on their plate) and a successful
   * clock-out (so the UI can confirm they finished — or flag what's left).
   */
  taskSummary?: TodayTaskSummary;
  /** Human-readable reminder message to surface in a toast. */
  reminder?: string;
}
