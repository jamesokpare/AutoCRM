"use server";

import { Role } from "@crm-tool/db";
import { auth } from "@crm-tool/auth";
import { headers } from "next/headers";

import { prisma } from "@/lib/db";
import { withMutation } from "@/lib/mutation";
import { requirePermission } from "@/lib/rbac";
import type { ActionResult, AdminUserRow } from "./actions-types";

const ALL_ROLES = Object.values(Role) as Role[];

interface SessionUser {
  id: string;
  roles?: Role[] | null;
}

/** Loads the session and asserts the caller may manage users (AUTH-04). */
async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  requirePermission(
    session ? { user: { roles: (session.user as SessionUser).roles } } : null,
    "manage_users",
  );
  return session!.user as SessionUser;
}

/** AUTH-04: list all users for the admin screen. */
export async function listUsers(): Promise<AdminUserRow[]> {
  await requireAdmin();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      roles: true,
      profileCompleted: true,
      banned: true,
      createdAt: true,
    },
  });
  return users.map((u) => ({ ...u, banned: u.banned ?? false }));
}

/** AUTH-04: set a user's CRM roles. */
export async function setRoles(userId: string, roles: Role[]): Promise<ActionResult> {
  const admin = await requireAdmin();
  const clean = (roles ?? []).filter((r): r is Role => ALL_ROLES.includes(r));
  await withMutation(
    {
      entityType: "User",
      action: "roles_changed",
      userId: admin.id,
      entityId: userId,
      metadata: { roles: clean },
    },
    async () => prisma.user.update({ where: { id: userId }, data: { roles: clean } }),
  );
  return { ok: true };
}

/** AUTH-04: deactivate (ban) / reactivate a user. */
export async function deactivateUser(userId: string, banned = true): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (userId === admin.id) {
    return { ok: false, error: "You cannot deactivate your own account." };
  }
  await withMutation(
    {
      entityType: "User",
      action: banned ? "deactivated" : "reactivated",
      userId: admin.id,
      entityId: userId,
    },
    async () =>
      prisma.user.update({
        where: { id: userId },
        data: { banned, banReason: banned ? "Deactivated by admin" : null },
      }),
  );
  return { ok: true };
}

/** AUTH-04: permanently delete a user. */
export async function deleteUser(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (userId === admin.id) {
    return { ok: false, error: "You cannot delete your own account." };
  }
  await withMutation(
    { entityType: "User", action: "deleted", userId: admin.id, entityId: userId },
    async () => prisma.user.delete({ where: { id: userId } }),
  );
  return { ok: true };
}
