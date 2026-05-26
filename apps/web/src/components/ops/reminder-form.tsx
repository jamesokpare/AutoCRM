"use client";

import { ReminderType } from "@crm-tool/db/enums";
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
import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createReminder } from "@/lib/actions/reminders";
import type { ReminderTargets } from "@/lib/queries/reminders";
import { fromWatLocalInput, toWatLocalInput } from "@/components/ops/wat";

const TYPES = Object.values(ReminderType) as ReminderType[];

const selectClass =
  "h-8 w-full rounded-none border border-input bg-transparent px-2.5 py-1 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 dark:bg-input/30";

/** REM-06: create one-off / recurring reminders on an order or client. */
export function ReminderForm({
  targets,
  onCreated,
}: {
  targets: ReminderTargets;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [type, setType] = useState<ReminderType>(ReminderType.CUSTOM);
  const [attachTo, setAttachTo] = useState<"none" | "order" | "client">("none");
  const [orderId, setOrderId] = useState("");
  const [clientId, setClientId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [recurrence, setRecurrence] = useState("");
  // datetime-local value interpreted as WAT wall-clock; default = now + 1h.
  const [dueLocal, setDueLocal] = useState(() =>
    toWatLocalInput(new Date(Date.now() + 60 * 60 * 1000)),
  );

  function reset() {
    setType(ReminderType.CUSTOM);
    setAttachTo("none");
    setOrderId("");
    setClientId("");
    setAssigneeId("");
    setRecurrence("");
    setDueLocal(toWatLocalInput(new Date(Date.now() + 60 * 60 * 1000)));
  }

  function submit() {
    if (!dueLocal) {
      toast.error("Pick a due date/time.");
      return;
    }
    startTransition(async () => {
      const res = await createReminder({
        type,
        orderId: attachTo === "order" ? orderId || null : null,
        clientId: attachTo === "client" ? clientId || null : null,
        // Convert WAT wall-clock → UTC instant for storage.
        dueAt: fromWatLocalInput(dueLocal).toISOString(),
        recurrence: recurrence || null,
        assigneeId: assigneeId || null,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Failed to create reminder");
        return;
      }
      toast.success("Reminder created");
      setOpen(false);
      reset();
      onCreated();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" /> New reminder
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New reminder</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="rem-type">Type</Label>
            <select
              id="rem-type"
              className={selectClass}
              value={type}
              onChange={(e) => setType(e.target.value as ReminderType)}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="rem-attach">Attach to</Label>
            <select
              id="rem-attach"
              className={selectClass}
              value={attachTo}
              onChange={(e) => setAttachTo(e.target.value as "none" | "order" | "client")}
            >
              <option value="none">Nothing (general)</option>
              <option value="order">An order</option>
              <option value="client">A client</option>
            </select>
          </div>

          {attachTo === "order" ? (
            <div className="flex flex-col gap-1">
              <Label htmlFor="rem-order">Order</Label>
              <select
                id="rem-order"
                className={selectClass}
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
              >
                <option value="">Select an order…</option>
                {targets.orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {attachTo === "client" ? (
            <div className="flex flex-col gap-1">
              <Label htmlFor="rem-client">Client</Label>
              <select
                id="rem-client"
                className={selectClass}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">Select a client…</option>
                {targets.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="flex flex-col gap-1">
            <Label htmlFor="rem-due">Due (WAT)</Label>
            <Input
              id="rem-due"
              type="datetime-local"
              value={dueLocal}
              onChange={(e) => setDueLocal(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="rem-rec">Recurrence (optional)</Label>
              <Input
                id="rem-rec"
                value={recurrence}
                placeholder="e.g. weekly"
                onChange={(e) => setRecurrence(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="rem-assignee">Assignee (optional)</Label>
              <select
                id="rem-assignee"
                className={selectClass}
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {targets.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={pending} onClick={submit}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
