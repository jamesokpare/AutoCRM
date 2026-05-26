/**
 * Shared types for attendance (clock-in/out) server actions.
 *
 * Kept OUTSIDE `attendance.ts` because that file carries the `"use server"`
 * directive, and a server-action module may only export async functions.
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
}
