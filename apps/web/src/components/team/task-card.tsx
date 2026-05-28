"use client";

import { TaskStatus } from "@crm-tool/db/enums";
import { Button } from "@crm-tool/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@crm-tool/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@crm-tool/ui/components/select";
import { cn } from "@crm-tool/ui/lib/utils";
import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteTask, setTaskStatus } from "@/lib/actions/tasks";

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
  currentUserId,
  onChanged,
}: {
  task: TaskDTO;
  /** Show a status badge inline (used in list/my-week; kanban groups by status). */
  showStatusBadge?: boolean;
  /** Used to decide whether the delete affordance is shown. */
  currentUserId?: string;
  onChanged?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, startDelete] = useTransition();
  const canDelete =
    !!currentUserId &&
    (task.createdBy.id === currentUserId || task.assignee.id === currentUserId);

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

        {canDelete ? (
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="ml-auto text-muted-foreground hover:text-destructive"
                  aria-label="Delete task"
                  title="Delete task"
                >
                  <Trash2 className="size-3" />
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete task?</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                "{task.title}" will be permanently removed.
              </p>
              <DialogFooter>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={deletePending}
                  onClick={() => setDeleteOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={deletePending}
                  onClick={() =>
                    startDelete(async () => {
                      const res = await deleteTask(task.id);
                      if (!res.ok) {
                        toast.error(res.error ?? "Failed to delete task");
                        return;
                      }
                      toast.success("Task deleted");
                      setDeleteOpen(false);
                      onChanged?.();
                    })
                  }
                >
                  {deletePending ? "Deleting…" : "Delete"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
    </div>
  );
}
