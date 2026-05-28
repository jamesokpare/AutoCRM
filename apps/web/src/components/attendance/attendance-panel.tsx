"use client";

import { Button } from "@crm-tool/ui/components/button";
import { Card } from "@crm-tool/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { LogIn, LogOut } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { clockIn, clockOut, fetchTodayAttendance } from "@/lib/actions/attendance";
import type { AttendanceRow } from "@/lib/queries/attendance";
import { formatWatDate } from "@/components/ops/wat";

function fmtTime(d: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(d));
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

  // Keep myOpen in sync with refetched rows for the current user. A shift that
  // started on a previous WAT day won't appear in today's rows, so only flip
  // state when we actually see one of the user's rows.
  useEffect(() => {
    const mine = rows.filter((r) => r.userId === currentUserId);
    if (mine.length === 0) return;
    setMyOpen(mine.some((r) => r.clockOut === null));
  }, [rows, currentUserId]);

  function act(fn: typeof clockIn, label: string, nextOpen: boolean) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? "Something went wrong.");
        return;
      }
      toast.success(label);
      setMyOpen(nextOpen);
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
            onClick={() => act(clockIn, "Clocked in", true)}
          >
            <LogIn className="size-4" /> Clock in
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !myOpen || !!loadError}
            onClick={() => act(clockOut, "Clocked out", false)}
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
    </div>
  );
}
