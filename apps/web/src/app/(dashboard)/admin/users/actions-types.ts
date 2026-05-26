import type { Role } from "@crm-tool/db";

/**
 * Shared types for the admin users server actions.
 *
 * These live OUTSIDE `actions.ts` because that file carries the `"use server"`
 * directive, and a server-action module may only export async functions.
 * Exporting types from it breaks the server-action boundary and pulls the
 * server-only Prisma client into client bundles.
 */

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  isApproved: boolean;
  profileCompleted: boolean;
  banned: boolean;
  createdAt: Date;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}
