"use server";

import { auth } from "@crm-tool/auth";
import { Role } from "@crm-tool/db";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { withMutation } from "@/lib/mutation";
import type { DeleteAccountInput, ProfileActionResult, UpdateProfileInput } from "./profile-types";

const ALL_ROLES = Object.values(Role) as Role[];

/**
 * EMP-01/02: update the authenticated user's own employee profile — name,
 * role(s), photo URL, KPIs and bottlenecks.
 *
 * Editing one's OWN profile is always allowed for an authenticated user
 * (SPEC §5 footnote / task brief), so this does NOT route through
 * `requirePermission` — but it strictly scopes the update to `session.user.id`
 * so a user can never edit anyone else. Approval/role-management remains
 * admin-only (see /admin/users); this only lets the user describe themselves.
 */
export async function updateProfile(input: UpdateProfileInput): Promise<ProfileActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { ok: false, error: "You must be signed in." };
  }

  const name = input.name?.trim();
  if (!name) {
    return { ok: false, error: "Name is required." };
  }

  const roles = (input.roles ?? []).filter((r): r is Role => ALL_ROLES.includes(r));
  if (roles.length === 0) {
    return { ok: false, error: "Select at least one role." };
  }

  const photo = input.photo?.trim() || null;
  if (photo && !/^https?:\/\//i.test(photo)) {
    return { ok: false, error: "Photo must be a valid http(s) URL." };
  }

  const userId = session.user.id;

  await withMutation(
    { entityType: "User", action: "profile_updated", userId, entityId: userId },
    async () =>
      prisma.user.update({
        where: { id: userId },
        data: {
          name,
          roles,
          photo,
          jobTitle: input.jobTitle?.trim() || null,
          kpis: input.kpis?.trim() || null,
          bottlenecks: input.bottlenecks?.trim() || null,
        },
      }),
  );

  revalidatePath("/profile");
  revalidatePath("/team");
  return { ok: true };
}

/**
 * Permanently delete the signed-in user's own account.
 *
 * The user must re-type their email to confirm. Related rows are removed by
 * the `onDelete: Cascade` relations on the User model (sessions, accounts,
 * attendance, reviews, tasks the user authored/assigned, etc.). After the
 * row is gone the existing session cookie is already invalid; the client
 * still calls `authClient.signOut` to clear it locally and route home.
 */
export async function deleteOwnAccount(input: DeleteAccountInput): Promise<ProfileActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { ok: false, error: "You must be signed in." };
  }

  const typed = input.confirmEmail?.trim().toLowerCase();
  const actual = session.user.email?.trim().toLowerCase();
  if (!typed || typed !== actual) {
    return { ok: false, error: "Email did not match — account was not deleted." };
  }

  // No `withMutation` wrapper here: ActivityLog rows cascade-delete with the
  // user (FK onDelete: Cascade), so any self-audit row would vanish in the
  // same transaction. The admin-initiated delete in /admin/users does log,
  // because the actor is a different (surviving) user.
  await prisma.user.delete({ where: { id: session.user.id } });

  return { ok: true };
}
