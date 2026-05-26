import { auth } from "@crm-tool/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { NotificationList } from "@/components/ops/notification-list";
import { fetchNotifications } from "@/lib/actions/notifications-actions";

/**
 * Pull-based notification centre. Lists the current user's Notification rows
 * (read/unread) with an unread count; markRead / markAllRead. Loads on
 * navigation; the client also refetches on window focus (TanStack Query).
 */
export default async function NotificationsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const initial = await fetchNotifications();
  return <NotificationList initial={initial} />;
}
