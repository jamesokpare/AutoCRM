"use client";

import { Badge } from "@crm-tool/ui/components/badge";
import { Button } from "@crm-tool/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@crm-tool/ui/components/dialog";
import { useQuery } from "@tanstack/react-query";
import { Check, CheckCheck, Trash2, X } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  clearAllNotifications,
  deleteNotification,
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

  function dismiss() {
    startTransition(async () => {
      const res = await deleteNotification(n.id);
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
      <div className="flex shrink-0 items-center gap-0.5">
        <Button size="xs" variant="ghost" disabled={pending} onClick={toggle}>
          <Check className="size-3" /> {n.read ? "Mark unread" : "Mark read"}
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          disabled={pending}
          onClick={dismiss}
          aria-label="Dismiss notification"
          title="Dismiss"
        >
          <X className="size-3.5" />
        </Button>
      </div>
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
  const [clearOpen, setClearOpen] = useState(false);

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

  function clearAll() {
    startTransition(async () => {
      const res = await clearAllNotifications();
      if (!res.ok) {
        toast.error(res.error ?? "Failed");
        return;
      }
      toast.success(
        res.count ? `Cleared ${res.count} notification${res.count === 1 ? "" : "s"}` : "Cleared",
      );
      setClearOpen(false);
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
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            disabled={pending || data.unreadCount === 0}
            onClick={allRead}
          >
            <CheckCheck className="size-4" /> Mark all read
          </Button>
          <Dialog open={clearOpen} onOpenChange={setClearOpen}>
            <DialogTrigger
              render={
                <Button size="sm" variant="outline" disabled={pending || data.items.length === 0}>
                  <Trash2 className="size-4" /> Clear all
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Clear all notifications?</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                This permanently removes all of your notifications — read and unread. This cannot
                be undone.
              </p>
              <DialogFooter>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setClearOpen(false)}
                >
                  Cancel
                </Button>
                <Button size="sm" variant="destructive" disabled={pending} onClick={clearAll}>
                  {pending ? "Clearing…" : "Clear all"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
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
