"use client";

import { useRouter } from "next/navigation";

import { TaskCard } from "./task-card";
import { TaskForm } from "./task-form";
import type { PersonDTO, TaskDTO } from "./types";

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

/**
 * EMP-03/05: the current user's weekly task view, built from daily entries and
 * grouped by work day. Unfinished prior-week tasks appear here too (carry-over),
 * grouped under their original day and flagged on the card.
 */
export function MyWeek({
  tasks,
  members,
  currentUserId,
  weekLabel,
}: {
  tasks: TaskDTO[];
  members: PersonDTO[];
  currentUserId: string;
  weekLabel: string;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  // Group by work day (already ordered by date asc from the query).
  const groups = new Map<string, TaskDTO[]>();
  for (const t of tasks) {
    const key = dayKey(t.date);
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">My week</h1>
          <p className="text-xs text-muted-foreground">{weekLabel}</p>
        </div>
        <TaskForm members={members} currentUserId={currentUserId} triggerLabel="Add task" />
      </div>

      {tasks.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">
          No tasks this week. Add one to get started.
        </p>
      ) : (
        <div className="space-y-5">
          {[...groups.entries()].map(([day, dayTasks]) => (
            <div key={day} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {day}
              </h2>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                {dayTasks.map((t) => (
                  <TaskCard key={t.id} task={t} showStatusBadge onChanged={refresh} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
