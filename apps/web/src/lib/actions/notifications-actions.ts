"use server";

import { auth } from "@crm-tool/auth";
import type { NotificationType } from "@crm-tool/db";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import type {
  ActionResult,
  NotificationFeed,
  NotificationView,
} from "./notifications-actions-types";

/**
 * Notification-centre mutations (pull-based phase).
 *
 * These mutate ONLY the calling user's own Notification rows (read/unread).
 * They are scoped by `userId` in the WHERE clause so a user can never mark
 * someone else's notifications. Creating notifications is M1's
 * `lib/notifications.ts#createNotification` — not redefined here.
 *
 * Read-state changes are not domain mutations (no ActivityLog), so they do not
 * route through `withMutation`.
 */

interface SessionUser {
  id: string;
}

async function requireUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ? (session.user as SessionUser) : null;
}

/**
 * Pull-based notification centre read (client-callable for TanStack
 * focus-refetch). Returns the caller's own rows (newest first) + unread count.
 */
export async function fetchNotifications(): Promise<NotificationFeed> {
  const user = await requireUser();
  if (!user) return { items: [], unreadCount: 0 };
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  return {
    items: rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      link: n.link ?? null,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  };
}

/** Mark a single notification read (only if it belongs to the caller). */
export async function markRead(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const res = await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { read: true },
  });
  revalidatePath("/notifications");
  return { ok: true, count: res.count };
}

/** Mark a single notification unread (only if it belongs to the caller). */
export async function markUnread(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const res = await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { read: false },
  });
  revalidatePath("/notifications");
  return { ok: true, count: res.count };
}

/** Mark all of the caller's notifications read. */
export async function markAllRead(): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const res = await prisma.notification.updateMany({
    where: { userId: user.id, read: false },
    data: { read: true },
  });
  revalidatePath("/notifications");
  return { ok: true, count: res.count };
}

/** Delete a single notification (only if it belongs to the caller). */
export async function deleteNotification(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const res = await prisma.notification.deleteMany({
    where: { id, userId: user.id },
  });
  revalidatePath("/notifications");
  return { ok: true, count: res.count };
}

/** Delete all of the caller's notifications (read and unread). */
export async function clearAllNotifications(): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const res = await prisma.notification.deleteMany({
    where: { userId: user.id },
  });
  revalidatePath("/notifications");
  return { ok: true, count: res.count };
}
