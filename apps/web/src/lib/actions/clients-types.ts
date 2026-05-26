/**
 * Shared types for client/vehicle server actions.
 *
 * These live OUTSIDE `clients.ts` because that file carries the `"use server"`
 * directive, and a server-action module may only export async functions.
 * Exporting types from it breaks the server-action boundary and pulls the
 * server-only Prisma client into client bundles.
 */

/** Uniform result shape for client-component form handlers. */
export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}
