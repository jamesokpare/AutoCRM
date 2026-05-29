import type { Role } from "@crm-tool/db";

/**
 * Shared types for the onboarding server actions.
 *
 * These live OUTSIDE `actions.ts` because that file carries the `"use server"`
 * directive, and a server-action module may only export async functions.
 * Exporting types from it breaks the server-action boundary and pulls the
 * server-only Prisma client into client bundles.
 */

export interface CompleteProfileInput {
  roles: Role[];
  /** Free-text role / job title in the employee's own words. */
  jobTitle: string;
  kpis: string;
  bottlenecks: string;
}

export interface CompleteProfileResult {
  ok: boolean;
  error?: string;
}
