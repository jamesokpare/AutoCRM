"use server";

import { Role } from "@crm-tool/db";
import { auth } from "@crm-tool/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { withMutation } from "@/lib/mutation";
import type { CompleteProfileInput, CompleteProfileResult } from "./actions-types";

const ALL_ROLES = Object.values(Role) as Role[];

/**
 * AUTH-02: first-login profile completion. Validates + persists the user's
 * role(s), KPIs and bottlenecks, then sets `profileCompleted = true`.
 *
 * Accounts are usable immediately after onboarding — there is no admin-approval
 * gate; what a user can edit is governed purely by their role(s) (SPEC §5).
 */
export async function completeProfile(input: CompleteProfileInput): Promise<CompleteProfileResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { ok: false, error: "Not authenticated." };
  }

  const roles = (input.roles ?? []).filter((r): r is Role => ALL_ROLES.includes(r));
  if (roles.length === 0) {
    return { ok: false, error: "Select at least one role." };
  }

  const userId = session.user.id;

  await withMutation(
    { entityType: "User", action: "profile_completed", userId, entityId: userId },
    async () =>
      prisma.user.update({
        where: { id: userId },
        data: {
          roles,
          jobTitle: input.jobTitle?.trim() || null,
          kpis: input.kpis?.trim() || null,
          bottlenecks: input.bottlenecks?.trim() || null,
          profileCompleted: true,
          isApproved: true,
        },
      }),
  );

  // Redirect server-side rather than from the client. The router may hold a
  // cached `/dashboard` RSC payload from a pre-completion visit (when the layout
  // guard redirected back to `/onboarding`); a client `router.push` would replay
  // that stale redirect and bounce the user. Revalidating + redirecting here
  // forces a fresh render with the now-completed session.
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
