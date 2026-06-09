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
import { Pencil, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteTask, setTaskStatus } from "@/lib/actions/tasks";

import { PersonAvatar } from "./person-avatar";
import { PriorityBadge, StatusBadge } from "./task-badges";
import { TaskForm } from "./task-form";
import type { PersonDTO, TaskDTO } from "./types";

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
  members,
  onChanged,
}: {
  task: TaskDTO;
  /** Show a status badge inline (used in list/my-week; kanban groups by status). */
  showStatusBadge?: boolean;
  /** Used to decide whether the delete/edit affordances are shown. */
  currentUserId?: string;
  /** Team roster — when supplied, an edit affordance is shown to the creator/assignee. */
  members?: PersonDTO[];
  onChanged?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, startDelete] = useTransition();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const ownsTask =
    !!currentUserId &&
    (task.createdBy.id === currentUserId || task.assignee.id === currentUserId);
  const canDelete = ownsTask;
  const canEdit = ownsTask && !!members;

  const highlight = task.overdue || task.status === TaskStatus.FAILED;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 border bg-card p-3 text-xs",
        highlight ? "border-destructive/50 bg-destructive/5" : "border-border",
      )}
    >
      <button
        type="button"
        onClick={() => setDetailsOpen(true)}
        className="flex flex-col gap-2 text-left outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
        aria-label={`View details for ${task.title}`}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium leading-tight hover:underline">{task.title}</p>
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
      </button>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{task.title}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
              {task.overdue ? (
                <span className="font-medium text-destructive">Overdue</span>
              ) : null}
              {task.carriedOver ? (
                <span className="text-amber-600 dark:text-amber-400">Carried over</span>
              ) : null}
            </div>

            <div>
              <p className="font-medium text-muted-foreground">Details</p>
              {task.description ? (
                <p className="mt-1 whitespace-pre-wrap">{task.description}</p>
              ) : (
                <p className="mt-1 italic text-muted-foreground">No details provided.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="font-medium text-muted-foreground">Work day</p>
                <p className="mt-1">{fmtDate(task.date)}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Due date</p>
                <p className={cn("mt-1", task.overdue && "font-medium text-destructive")}>
                  {fmtDate(task.dueDate)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="font-medium text-muted-foreground">Assigned to</p>
                <span className="mt-1 inline-flex items-center gap-1.5">
                  <PersonAvatar person={task.assignee} className="size-5" />
                  {task.assignee.name}
                </span>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Created by</p>
                <span className="mt-1 inline-flex items-center gap-1.5">
                  <PersonAvatar person={task.createdBy} className="size-5" />
                  {task.createdBy.name}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

        {canEdit && members ? (
          <TaskForm
            members={members}
            currentUserId={currentUserId!}
            task={task}
            open={editOpen}
            onOpenChange={(next) => {
              setEditOpen(next);
              if (!next) onChanged?.();
            }}
            trigger={
              <Button
                size="icon-xs"
                variant="ghost"
                className="ml-auto text-muted-foreground hover:text-foreground"
                aria-label="Edit task"
                title="Edit task"
              >
                <Pencil className="size-3" />
              </Button>
            }
          />
        ) : null}

        {canDelete ? (
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className={cn(
                    "text-muted-foreground hover:text-destructive",
                    canEdit && members ? "" : "ml-auto",
                  )}
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
