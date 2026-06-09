"use client";

import { TaskPriority } from "@crm-tool/db/enums";
import { Button } from "@crm-tool/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@crm-tool/ui/components/dialog";
import { Input } from "@crm-tool/ui/components/input";
import { Label } from "@crm-tool/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@crm-tool/ui/components/select";
import { Textarea } from "@crm-tool/ui/components/textarea";
import { useRouter } from "next/navigation";
import { type ReactElement, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { createTask, updateTask } from "@/lib/actions/tasks";

import type { PersonDTO, TaskDTO } from "./types";

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: TaskPriority.LOW, label: "Low" },
  { value: TaskPriority.MEDIUM, label: "Medium" },
  { value: TaskPriority.HIGH, label: "High" },
  { value: TaskPriority.URGENT, label: "Urgent" },
];

function todayISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

function isoDateOnly(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

/**
 * Dual-purpose dialog: create a new task, or edit an existing one when `task`
 * is supplied. The fields, validation, and member picker are identical between
 * the two modes — only the submitted action and labels differ.
 */
export function TaskForm({
  members,
  currentUserId,
  triggerLabel = "New task",
  task,
  trigger,
  open: openProp,
  onOpenChange,
}: {
  members: PersonDTO[];
  currentUserId: string;
  triggerLabel?: string;
  /** When supplied, the form edits this task instead of creating a new one. */
  task?: TaskDTO;
  /** Custom trigger element (e.g. an icon button on a card). */
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
}) {
  const router = useRouter();
  const isEdit = !!task;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (openProp === undefined) setInternalOpen(next);
  };
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [date, setDate] = useState(task ? isoDateOnly(task.date) : todayISO());
  const [dueDate, setDueDate] = useState(isoDateOnly(task?.dueDate));
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? TaskPriority.MEDIUM);
  const [assigneeId, setAssigneeId] = useState(task?.assignee.id ?? currentUserId);

  // Re-sync fields when the dialog opens — the parent may pass a refreshed task
  // after a server revalidate.
  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setDate(isoDateOnly(task.date));
      setDueDate(isoDateOnly(task.dueDate));
      setPriority(task.priority);
      setAssigneeId(task.assignee.id);
    }
  }, [open, task]);

  function reset() {
    if (isEdit) return;
    setTitle("");
    setDescription("");
    setDate(todayISO());
    setDueDate("");
    setPriority(TaskPriority.MEDIUM);
    setAssigneeId(currentUserId);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button size="sm">{triggerLabel}</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit task" : "Create task"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs doing?"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Details (optional)</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any context"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-date">Work day</Label>
              <Input
                id="task-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-due">Due date (optional)</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                items={PRIORITY_OPTIONS}
                value={priority}
                onValueChange={(v) => setPriority(v as TaskPriority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Assign to</Label>
              <Select
                items={members.map((m) => ({
                  value: m.id,
                  label: m.id === currentUserId ? `${m.name} (me)` : m.name,
                }))}
                value={assigneeId}
                onValueChange={(v) => setAssigneeId(v as string)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.id === currentUserId ? `${m.name} (me)` : m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                if (!title.trim()) {
                  toast.error("Title is required");
                  return;
                }
                const res = isEdit
                  ? await updateTask({
                      taskId: task!.id,
                      title,
                      description,
                      date,
                      dueDate: dueDate || null,
                      priority,
                      assigneeId,
                    })
                  : await createTask({
                      title,
                      description,
                      date,
                      dueDate: dueDate || null,
                      priority,
                      assigneeId,
                    });
                if (!res.ok) {
                  toast.error(res.error ?? (isEdit ? "Failed to update task" : "Failed to create task"));
                  return;
                }
                toast.success(isEdit ? "Task updated" : "Task created");
                reset();
                setOpen(false);
                router.refresh();
              })
            }
          >
            {pending
              ? isEdit
                ? "Saving…"
                : "Creating…"
              : isEdit
                ? "Save changes"
                : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
