import { auth } from "@crm-tool/auth";
import type { Role } from "@crm-tool/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { can } from "@/lib/rbac";

import { listUsers } from "./actions";
import { UsersTable } from "./users-table";

/**
 * AUTH-04: admin user management. Lists users; set roles, deactivate, delete.
 * Guarded to ADMIN (manage_users capability).
 */
export default async function AdminUsersPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const roles = ((session?.user as { roles?: Role[] } | undefined)?.roles ?? []) as Role[];
  if (!session?.user || !can(roles, "manage_users")) {
    redirect("/dashboard");
  }

  const users = await listUsers();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">User Administration</h1>
        <p className="text-xs text-muted-foreground">
          Assign roles, deactivate or delete users.
        </p>
      </div>
      <UsersTable initialUsers={users} currentUserId={session.user.id} />
    </div>
  );
}
