"use server";

import { auth } from "@crm-tool/auth";
import type { Role } from "@crm-tool/db";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { PermissionError, requirePermission } from "@/lib/rbac";

export interface ClearEmployeeActivityInput {
  userId: string;
  year: number;
  /** 1-based month (1 = January). */
  month: number;
}

export interface ClearEmployeeActivityResult {
  ok: boolean;
  error?: string;
  deleted?: number;
}

interface SessionUser {
  id: string;
  roles?: Role[] | null;
}

/**
 * Admin-only: delete every `ActivityLog` row authored by `userId` whose
 * `createdAt` falls in the given month. Used by the reports page to clear an
 * employee's monthly activity. A single audit row is written naming the cleared
 * user + month so the destructive action itself remains traceable.
 */
export async function clearEmployeeMonthlyActivity(
  input: ClearEmployeeActivityInput,
): Promise<ClearEmployeeActivityResult> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const user = session?.user as SessionUser | undefined;
    requirePermission(user ? { user: { roles: user.roles } } : null, "manage_users");

    const { userId, year, month } = input;
    if (!userId) return { ok: false, error: "Missing employee." };
    if (!Number.isInteger(year) || year < 1970 || year > 9999) {
      return { ok: false, error: "Invalid year." };
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return { ok: false, error: "Invalid month." };
    }

    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 1));

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });
    if (!target) return { ok: false, error: "Employee not found." };

    const { count } = await prisma.activityLog.deleteMany({
      where: {
        userId,
        createdAt: { gte: monthStart, lt: monthEnd },
      },
    });

    await prisma.activityLog.create({
      data: {
        entityType: "User",
        entityId: userId,
        action: "activity_cleared",
        userId: user!.id,
        metadata: {
          targetName: target.name,
          targetEmail: target.email,
          year,
          month,
          deleted: count,
        },
      },
    });

    revalidatePath("/reports");
    return { ok: true, deleted: count };
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}
