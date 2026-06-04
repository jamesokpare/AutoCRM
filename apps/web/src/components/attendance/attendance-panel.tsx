"use client";

import { Button } from "@crm-tool/ui/components/button";
import { Card } from "@crm-tool/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@crm-tool/ui/components/dialog";
import { useQuery } from "@tanstack/react-query";
import { LogIn, LogOut } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { clockIn, clockOut, fetchTodayAttendance } from "@/lib/actions/attendance";
import type { ActionResult } from "@/lib/actions/attendance-types";
import type { AttendanceRow } from "@/lib/queries/attendance";
import { formatWatDate } from "@/components/ops/wat";
import { PriorityBadge, StatusBadge } from "@/components/team/task-badges";
import type { TodayTaskBrief } from "@/lib/queries/tasks";

function fmtTime(d: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(d));
}

function fmtTaskDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    day: "2-digit",
    month: "short",
  }).format(new Date(iso));
}

interface TaskDialogState {
  mode: "in" | "out";
  tasks: TodayTaskBrief[];
  reminder: string | null;
}

export function AttendancePanel({
  initialRows,
  currentUserId,
  initiallyClockedIn,
  loadError = null,
}: {
  initialRows: AttendanceRow[];
  currentUserId: string;
  initiallyClockedIn: boolean;
  loadError?: string | null;
}) {
  const { data: rows = initialRows, refetch } = useQuery({
    queryKey: ["attendance-today"],
    queryFn: () => fetchTodayAttendance(),
    initialData: initialRows,
    // If the initial load already failed (e.g. table missing on prod), don't
    // immediately retry the same query and overwrite the empty fallback.
    enabled: !loadError,
  });

  const [pending, startTransition] = useTransition();
  const [myOpen, setMyOpen] = useState(initiallyClockedIn);
  const [taskDialog, setTaskDialog] = useState<TaskDialogState | null>(null);

  // Keep myOpen in sync with refetched rows for the current user. A shift that
  // started on a previous WAT day won't appear in today's rows, so only flip
  // state when we actually see one of the user's rows.
  useEffect(() => {
    const mine = rows.filter((r) => r.userId === currentUserId);
    if (mine.length === 0) return;
    setMyOpen(mine.some((r) => r.clockOut === null));
  }, [rows, currentUserId]);

  function act(
    fn: () => Promise<ActionResult>,
    label: string,
    nextOpen: boolean,
    mode: "in" | "out",
  ) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? "Something went wrong.");
        return;
      }
      toast.success(label);
      setMyOpen(nextOpen);
      setTaskDialog({
        mode,
        tasks: res.tasks ?? [],
        reminder: res.reminder ?? null,
      });
      refetch();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Attendance</h1>
          <p className="text-xs text-muted-foreground">
            Clock in at the start of your day and clock out when you finish. Today&apos;s
            attendance is visible to the whole team.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={pending || myOpen || !!loadError}
            onClick={() => act(clockIn, "Clocked in", true, "in")}
          >
            <LogIn className="size-4" /> Clock in
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !myOpen || !!loadError}
            onClick={() => act(clockOut, "Clocked out", false, "out")}
          >
            <LogOut className="size-4" /> Clock out
          </Button>
        </div>
      </div>

      {loadError ? (
        <Card className="border-destructive/50 bg-destructive/5 p-3 text-xs">
          <p className="font-medium text-destructive">Attendance unavailable</p>
          <p className="mt-1 text-muted-foreground">
            Could not load attendance data. The schema may be out of date on this
            environment — run <code className="font-mono">pnpm db:push</code> against the
            production database.
          </p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground/80">{loadError}</p>
        </Card>
      ) : (
        <p className="text-xs text-muted-foreground">
          {myOpen ? "You are currently clocked in." : "You are not clocked in."}
        </p>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Today · {formatWatDate(new Date())}</h2>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No one has clocked in yet today.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <Card key={r.id} className="flex flex-row items-center justify-between gap-3 p-3">
                <span className="font-medium">{r.userName}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  In {fmtTime(r.clockIn)}
                  {" · "}
                  {r.clockOut ? `Out ${fmtTime(r.clockOut)}` : "Still clocked in"}
                </span>
              </Card>
            ))}
          </div>
        )}
      </section>

      <TaskDialog state={taskDialog} onClose={() => setTaskDialog(null)} />
    </div>
  );
}

function TaskDialog({
  state,
  onClose,
}: {
  state: TaskDialogState | null;
  onClose: () => void;
}) {
  const open = state !== null;
  const title = state?.mode === "in" ? "Your tasks for today" : "Tasks at clock-out";

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {state?.reminder ? (
          <p className="text-sm text-muted-foreground">{state.reminder}</p>
        ) : null}

        {state && state.tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tasks tracked for today. Head to the Tasks board if you need to plan your day.
          </p>
        ) : null}

        {state && state.tasks.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {state.tasks.map((t) => (
              <li key={t.id}>
                <Card className="gap-2 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{t.title}</p>
                      {t.description ? (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground whitespace-pre-wrap">
                          {t.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1">
                      <StatusBadge status={t.status} />
                      <PriorityBadge priority={t.priority} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {t.carriedOver ? "Carried over · " : ""}
                    Work day {fmtTaskDate(t.date)}
                    {t.dueDate ? ` · Due ${fmtTaskDate(t.dueDate)}` : ""}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        ) : null}

        <DialogFooter>
          <Link href="/tasks">
            <Button size="sm" variant="outline">
              Open task board
            </Button>
          </Link>
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
