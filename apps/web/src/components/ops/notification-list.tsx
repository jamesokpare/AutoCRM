"use client";

import { Badge } from "@crm-tool/ui/components/badge";
import { Button } from "@crm-tool/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { Check, CheckCheck } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  fetchNotifications,
  markAllRead,
  markRead,
  markUnread,
} from "@/lib/actions/notifications-actions";
import type {
  NotificationFeed,
  NotificationView,
} from "@/lib/actions/notifications-actions-types";
import { formatWat } from "@/components/ops/wat";

function Row({ n, onChanged }: { n: NotificationView; onChanged: () => void }) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const res = n.read ? await markUnread(n.id) : await markRead(n.id);
      if (!res.ok) {
        toast.error(res.error ?? "Failed");
        return;
      }
      onChanged();
    });
  }

  return (
    <div
      className={`flex items-start justify-between gap-2 border-b px-3 py-2 last:border-b-0 ${
        n.read ? "" : "bg-muted/40"
      }`}
    >
      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline">{n.type}</Badge>
          {!n.read ? <Badge variant="warning">Unread</Badge> : null}
        </div>
        <div className="text-xs font-medium">
          {n.link ? (
            <Link href={n.link as Route} className="hover:underline">
              {n.title}
            </Link>
          ) : (
            n.title
          )}
        </div>
        {n.body ? <div className="text-xs text-muted-foreground">{n.body}</div> : null}
        <div className="text-xs text-muted-foreground">{formatWat(n.createdAt)} (WAT)</div>
      </div>
      <Button size="xs" variant="ghost" disabled={pending} onClick={toggle}>
        <Check className="size-3" /> {n.read ? "Mark unread" : "Mark read"}
      </Button>
    </div>
  );
}

export function NotificationList({ initial }: { initial: NotificationFeed }) {
  const { data = initial, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(),
    initialData: initial,
  });
  const [pending, startTransition] = useTransition();

  function allRead() {
    startTransition(async () => {
      const res = await markAllRead();
      if (!res.ok) {
        toast.error(res.error ?? "Failed");
        return;
      }
      toast.success("All marked read");
      refetch();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            Notifications
            {data.unreadCount > 0 ? (
              <Badge variant="warning">{data.unreadCount} unread</Badge>
            ) : null}
          </h1>
          <p className="text-xs text-muted-foreground">
            Pull-based — refreshes on navigation and window focus.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || data.unreadCount === 0}
          onClick={allRead}
        >
          <CheckCheck className="size-4" /> Mark all read
        </Button>
      </div>

      {data.items.length === 0 ? (
        <p className="text-xs text-muted-foreground">You have no notifications.</p>
      ) : (
        <div className="rounded-none ring-1 ring-foreground/10">
          {data.items.map((n) => (
            <Row key={n.id} n={n} onChanged={() => refetch()} />
          ))}
        </div>
      )}
    </div>
  );
}
