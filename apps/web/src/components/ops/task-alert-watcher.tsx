"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { fetchTaskAlerts } from "@/lib/actions/task-alerts";
import { useBimpSound } from "@/lib/use-bimp-sound";

/**
 * Plays a "bimping" chime when a task is assigned to the current user, and
 * nags periodically through the day while they still have open tasks.
 *
 * - Polls `fetchTaskAlerts` every minute (TanStack Query).
 * - On any TASK_ASSIGNED notification we haven't seen before → bimp 3× and toast.
 * - Every `REMIND_INTERVAL_MS` while open tasks remain → bimp 2× and toast.
 *
 * Browsers gate audio behind a user gesture, so first-load assignments may not
 * sound until the user clicks somewhere. We capture the next gesture and flush
 * any pending chime then. Seen-IDs are persisted in localStorage so a refresh
 * doesn't re-trigger the same notification.
 */

const POLL_MS = 60_000;
const REMIND_INTERVAL_MS = 60 * 60 * 1000; // hourly while open tasks remain
const SEEN_KEY = "crm.taskAlerts.seenIds";
const LAST_REMINDED_KEY = "crm.taskAlerts.lastRemindedAt";
const SEEN_LIMIT = 200;

function loadSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((v) => typeof v === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function persistSeen(set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    const arr = Array.from(set).slice(-SEEN_LIMIT);
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(arr));
  } catch {
    // storage may be unavailable (private mode); ignore.
  }
}

function loadLastReminded(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(LAST_REMINDED_KEY);
    const n = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function persistLastReminded(ts: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_REMINDED_KEY, String(ts));
  } catch {
    // ignore
  }
}

export function TaskAlertWatcher() {
  const bimp = useBimpSound();
  const seenRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef<{ assignments: number; reminder: boolean }>({
    assignments: 0,
    reminder: false,
  });
  const initializedRef = useRef(false);

  const { data } = useQuery({
    queryKey: ["task-alerts"],
    queryFn: () => fetchTaskAlerts(),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  // Drain pending chimes on the next user gesture — browsers won't let us
  // play audio until then on first load.
  useEffect(() => {
    if (typeof window === "undefined") return;
    function flush() {
      const pending = pendingRef.current;
      if (pending.assignments > 0) {
        void bimp(3);
        pending.assignments = 0;
      } else if (pending.reminder) {
        void bimp(2);
        pending.reminder = false;
      }
    }
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener("pointerdown", flush, opts);
    window.addEventListener("keydown", flush, opts);
    return () => {
      window.removeEventListener("pointerdown", flush);
      window.removeEventListener("keydown", flush);
    };
  }, [bimp]);

  useEffect(() => {
    if (!data) return;

    // Seed seen-ids from existing assignments on first run so we don't bimp
    // for everything already in the feed when the page loads.
    if (!initializedRef.current) {
      seenRef.current = loadSeen();
      if (seenRef.current.size === 0) {
        for (const a of data.recentAssignments) seenRef.current.add(a.notificationId);
        persistSeen(seenRef.current);
      }
      initializedRef.current = true;
      return;
    }

    // New assignments → bimp 3× and toast each.
    const fresh = data.recentAssignments.filter((a) => !seenRef.current.has(a.notificationId));
    if (fresh.length > 0) {
      for (const a of fresh) seenRef.current.add(a.notificationId);
      persistSeen(seenRef.current);

      for (const a of fresh) {
        toast.info(a.title, {
          description: a.body ?? "Open Tasks to see the details.",
          action: a.link
            ? { label: "Open", onClick: () => (window.location.href = a.link as string) }
            : undefined,
        });
      }

      void bimp(3).catch(() => {
        pendingRef.current.assignments += fresh.length;
      });
    }

    // Hourly nag while open tasks remain.
    if (data.openTaskCount > 0) {
      const last = loadLastReminded();
      const now = Date.now();
      if (now - last >= REMIND_INTERVAL_MS) {
        persistLastReminded(now);
        toast.message("You still have open tasks", {
          description: `${data.openTaskCount} task${data.openTaskCount === 1 ? "" : "s"} waiting in your queue.`,
          action: {
            label: "View",
            onClick: () => (window.location.href = "/tasks"),
          },
        });
        void bimp(2).catch(() => {
          pendingRef.current.reminder = true;
        });
      }
    }
  }, [data, bimp]);

  return null;
}
