import type { NotificationType } from "@crm-tool/db";

/**
 * Shared types for notification-centre server actions.
 *
 * These live OUTSIDE `notifications-actions.ts` because that file carries the
 * `"use server"` directive, and a server-action module may only export async
 * functions. Exporting types from it breaks the server-action boundary and
 * pulls the server-only Prisma client into client bundles.
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
  count?: number;
}

export interface NotificationView {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string; // ISO UTC
}

export interface NotificationFeed {
  items: NotificationView[];
  unreadCount: number;
}
