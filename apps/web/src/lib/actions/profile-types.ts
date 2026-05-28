import type { Role } from "@crm-tool/db";

/**
 * Shared types for profile server actions.
 *
 * These live OUTSIDE `profile.ts` because that file carries the `"use server"`
 * directive, and a server-action module may only export async functions.
 * Exporting types from it breaks the server-action boundary and pulls the
 * server-only Prisma client into client bundles.
 */

export interface UpdateProfileInput {
  name: string;
  roles: Role[];
  /** Free-text role / job title written by the employee. */
  jobTitle?: string | null;
  photo?: string | null;
  kpis?: string | null;
  bottlenecks?: string | null;
}

export interface ProfileActionResult {
  ok: boolean;
  error?: string;
}
