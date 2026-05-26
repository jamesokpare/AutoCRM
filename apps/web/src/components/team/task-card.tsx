"use client";

import { TaskStatus } from "@crm-tool/db/enums";
import { Button } from "@crm-tool/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@crm-tool/ui/components/select";
import { cn } from "@crm-tool/ui/lib/utils";
import { useTransition } from "react";
import { toast } from "sonner";

import { setTaskStatus } from "@/lib/actions/tasks";

import { PersonAvatar } from "./person-avatar";
import { PriorityBadge, StatusBadge } from "./task-badges";
import type { TaskDTO } from "./types";

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: TaskStatus.PENDING, label: "Pending" },
  { value: TaskStatus.IN_PROGRESS, label: "In Progress" },
  { value: TaskStatus.COMPLETED, label: "Completed" },
  { value: TaskStatus.FAILED, label: "Failed" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TaskCard({
  task,
  showStatusBadge = false,
  onChanged,
}: {
  task: TaskDTO;
  /** Show a status badge inline (used in list/my-week; kanban groups by status). */
  showStatusBadge?: boolean;
  onChanged?: () => void;
}) {
  const [pending, startTransition] = useTransition();

  const highlight = task.overdue || task.status === TaskStatus.FAILED;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 border bg-card p-3 text-xs",
        highlight ? "border-destructive/50 bg-destructive/5" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium leading-tight">{task.title}</p>
        <PriorityBadge priority={task.priority} />
      </div>

      {task.description ? (
        <p className="text-muted-foreground line-clamp-2">{task.description}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <PersonAvatar person={task.assignee} className="size-5" />
          {task.assignee.name}
        </span>
        <span>· Day {fmtDate(task.date)}</span>
        {task.dueDate ? (
          <span className={cn(task.overdue && "font-medium text-destructive")}>
            · Due {fmtDate(task.dueDate)}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {showStatusBadge ? <StatusBadge status={task.status} /> : null}
        {task.overdue ? (
          <span className="font-medium text-destructive">Overdue</span>
        ) : null}
        {task.carriedOver ? (
          <span className="text-amber-600 dark:text-amber-400">Carried over</span>
        ) : null}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Select
          items={STATUS_OPTIONS}
          value={task.status}
          onValueChange={(value) => {
            const next = value as TaskStatus;
            if (next === task.status) return;
            startTransition(async () => {
              const res = await setTaskStatus({ taskId: task.id, status: next });
              if (!res.ok) {
                toast.error(res.error ?? "Failed to update");
                return;
              }
              toast.success("Status updated");
              onChanged?.();
            });
          }}
        >
          <SelectTrigger className="h-7 w-36" disabled={pending}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {pending ? <Button size="xs" variant="ghost" disabled>…</Button> : null}
      </div>
    </div>
  );
}
