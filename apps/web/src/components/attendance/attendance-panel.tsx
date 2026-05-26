"use client";

import { Button } from "@crm-tool/ui/components/button";
import { Card } from "@crm-tool/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { LogIn, LogOut } from "lucide-react";
import { useTransition } from "react";
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
  initiallyClockedIn,
}: {
  initialRows: AttendanceRow[];
  initiallyClockedIn: boolean;
}) {
  const { data: rows = initialRows, refetch } = useQuery({
    queryKey: ["attendance-today"],
    queryFn: () => fetchTodayAttendance(),
    initialData: initialRows,
  });

  const [pending, startTransition] = useTransition();
  // Derive clock state from the live data when available, falling back to the
  // server-rendered value: an open (clockOut === null) row means clocked in.
  const myOpen = rows.some((r) => r.clockOut === null) || initiallyClockedIn;

  function act(fn: typeof clockIn, label: string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? "Something went wrong.");
        return;
      }
      toast.success(label);
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
          <Button size="sm" disabled={pending} onClick={() => act(clockIn, "Clocked in")}>
            <LogIn className="size-4" /> Clock in
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => act(clockOut, "Clocked out")}
          >
            <LogOut className="size-4" /> Clock out
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {myOpen ? "You are currently clocked in." : "You are not clocked in."}
      </p>

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
