"use server";

import { auth } from "@crm-tool/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { withMutation } from "@/lib/mutation";
import { PermissionError, requireAuth } from "@/lib/rbac";
import type { ActionResult } from "./client-updates-types";

/**
 * Daily client updates — short progress notes logged against a client.
 *
 * Adding and editing updates is intentionally open to every authenticated team
 * member (no role gate). All writes route through `withMutation` so an
 * ActivityLog row + the (no-op) domain-event seam fire uniformly.
 */

interface SessionUser {
  id: string;
}

async function requireUser(): Promise<SessionUser> {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user as SessionUser | undefined;
  requireAuth(user ? { user } : null);
  return user!;
}

function fail(err: unknown): ActionResult<never> {
  if (err instanceof PermissionError) return { ok: false, error: err.message };
  if (err instanceof Error) return { ok: false, error: err.message };
  return { ok: false, error: "Something went wrong." };
}

export async function addClientUpdate(
  clientId: string,
  note: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const clean = note?.trim();
    if (!clean) return { ok: false, error: "Update note is required." };

    const update = await withMutation(
      { entityType: "ClientUpdate", action: "created", userId: user.id, metadata: { clientId } },
      async () => prisma.clientUpdate.create({ data: { clientId, authorId: user.id, note: clean } }),
      (u) => u.id,
    );

    revalidatePath(`/clients/${clientId}`);
    return { ok: true, data: { id: update.id } };
  } catch (err) {
    return fail(err);
  }
}

export async function updateClientUpdate(
  updateId: string,
  note: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const clean = note?.trim();
    if (!clean) return { ok: false, error: "Update note is required." };

    const update = await withMutation(
      { entityType: "ClientUpdate", action: "updated", userId: user.id, entityId: updateId },
      async () => prisma.clientUpdate.update({ where: { id: updateId }, data: { note: clean } }),
    );

    revalidatePath(`/clients/${update.clientId}`);
    return { ok: true, data: { id: update.id } };
  } catch (err) {
    return fail(err);
  }
}
