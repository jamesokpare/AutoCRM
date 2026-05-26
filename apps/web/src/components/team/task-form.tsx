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
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createTask } from "@/lib/actions/tasks";

import type { PersonDTO } from "./types";

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

export function TaskForm({
  members,
  currentUserId,
  triggerLabel = "New task",
}: {
  members: PersonDTO[];
  currentUserId: string;
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [assigneeId, setAssigneeId] = useState(currentUserId);

  function reset() {
    setTitle("");
    setDescription("");
    setDate(todayISO());
    setDueDate("");
    setPriority(TaskPriority.MEDIUM);
    setAssigneeId(currentUserId);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">{triggerLabel}</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create task</DialogTitle>
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
                const res = await createTask({
                  title,
                  description,
                  date,
                  dueDate: dueDate || null,
                  priority,
                  assigneeId,
                });
                if (!res.ok) {
                  toast.error(res.error ?? "Failed to create task");
                  return;
                }
                toast.success("Task created");
                reset();
                setOpen(false);
                router.refresh();
              })
            }
          >
            {pending ? "Creating…" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
