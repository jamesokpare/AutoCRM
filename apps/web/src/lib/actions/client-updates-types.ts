/**
 * Shared types for the daily client-update server actions.
 *
 * Kept OUTSIDE `client-updates.ts` because that file carries the `"use server"`
 * directive, and a server-action module may only export async functions.
 */

export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}
