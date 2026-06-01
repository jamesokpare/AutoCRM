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
import { Plus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createReminder } from "@/lib/actions/reminders";
import type { ReminderTargets } from "@/lib/queries/reminders";
import { formatWat, fromWatLocalInput, toWatLocalInput } from "@/components/ops/wat";

const TYPES = Object.values(ReminderType) as ReminderType[];

/** Frequency choices the user can pick to repeat a reminder within one day. */
const FREQUENCY_OPTIONS: { label: string; minutes: number | null }[] = [
  { label: "Just once", minutes: null },
  { label: "Every 30 minutes", minutes: 30 },
  { label: "Every hour", minutes: 60 },
  { label: "Every 2 hours", minutes: 120 },
  { label: "Every 4 hours", minutes: 240 },
];

const selectClass =
  "h-8 w-full rounded-none border border-input bg-transparent px-2.5 py-1 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 dark:bg-input/30";

function defaultDueLocal(offsetMs = 60 * 60 * 1000): string {
  return toWatLocalInput(new Date(Date.now() + offsetMs));
}

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

  // Multiple due-time slots — each datetime-local is interpreted as WAT
  // wall-clock. The first slot defaults to "now + 1h"; the user can add more
  // slots manually or have the frequency generator fill them in.
  const [dueLocals, setDueLocals] = useState<string[]>(() => [defaultDueLocal()]);

  // Intra-day frequency. When non-null, indicates the user wants the reminder
  // to repeat every N minutes across a window — the form uses it as a generator
  // to expand the FIRST slot's time across `repeatUntilLocal`, AND the value is
  // sent to the server so each created row's `recurrence` shows the cadence.
  const [frequencyMinutes, setFrequencyMinutes] = useState<number | null>(null);
  const [repeatUntilLocal, setRepeatUntilLocal] = useState<string>(() =>
    defaultDueLocal(5 * 60 * 60 * 1000),
  );

  function reset() {
    setType(ReminderType.CUSTOM);
    setAttachTo("none");
    setOrderId("");
    setClientId("");
    setAssigneeId("");
    setRecurrence("");
    setDueLocals([defaultDueLocal()]);
    setFrequencyMinutes(null);
    setRepeatUntilLocal(defaultDueLocal(5 * 60 * 60 * 1000));
  }

  function updateSlot(i: number, value: string) {
    setDueLocals((prev) => prev.map((v, idx) => (idx === i ? value : v)));
  }

  function addSlot() {
    setDueLocals((prev) => [...prev, defaultDueLocal()]);
  }

  function removeSlot(i: number) {
    setDueLocals((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  /**
   * Expand the FIRST slot's time + the "repeat until" time using the chosen
   * intra-day frequency. Replaces the current slot list with the generated set
   * (sorted, capped at a sane upper bound to avoid runaway lists).
   */
  function generateFromFrequency() {
    if (!frequencyMinutes) {
      toast.error("Pick a frequency first.");
      return;
    }
    const start = fromWatLocalInput(dueLocals[0]);
    const end = fromWatLocalInput(repeatUntilLocal);
    if (end.getTime() <= start.getTime()) {
      toast.error("'Repeat until' must be after the first time.");
      return;
    }
    const stepMs = frequencyMinutes * 60 * 1000;
    const MAX_SLOTS = 48; // hard cap to keep the list readable
    const generated: string[] = [];
    for (let t = start.getTime(); t <= end.getTime() && generated.length < MAX_SLOTS; t += stepMs) {
      generated.push(toWatLocalInput(new Date(t)));
    }
    setDueLocals(generated);
    toast.success(`Generated ${generated.length} reminder slot${generated.length === 1 ? "" : "s"}.`);
  }

  function submit() {
    const cleaned = dueLocals.map((v) => v.trim()).filter(Boolean);
    if (cleaned.length === 0) {
      toast.error("Pick at least one due date/time.");
      return;
    }
    startTransition(async () => {
      const res = await createReminder({
        type,
        orderId: attachTo === "order" ? orderId || null : null,
        clientId: attachTo === "client" ? clientId || null : null,
        // Convert each WAT wall-clock → UTC instant for storage.
        dueAts: cleaned.map((v) => fromWatLocalInput(v).toISOString()),
        recurrence: recurrence || null,
        frequencyMinutes,
        assigneeId: assigneeId || null,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Failed to create reminder");
        return;
      }
      const count = res.count ?? 1;
      toast.success(
        count === 1 ? "Reminder created" : `${count} reminders created`,
      );
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

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Due times (WAT)</Label>
              <Button type="button" size="xs" variant="outline" onClick={addSlot}>
                <Plus className="size-3" /> Add time
              </Button>
            </div>
            <div className="flex flex-col gap-1.5">
              {dueLocals.map((value, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    type="datetime-local"
                    value={value}
                    onChange={(e) => updateSlot(i, e.target.value)}
                  />
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    disabled={dueLocals.length <= 1}
                    onClick={() => removeSlot(i)}
                    aria-label="Remove time slot"
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground">
                Add as many times as you want — each becomes its own reminder.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-none border border-dashed p-2">
            <Label className="text-xs font-medium">Repeat within a day</Label>
            <div className="grid grid-cols-2 gap-2">
              <select
                className={selectClass}
                value={frequencyMinutes ?? ""}
                onChange={(e) =>
                  setFrequencyMinutes(e.target.value === "" ? null : Number(e.target.value))
                }
              >
                {FREQUENCY_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.minutes ?? ""}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <Input
                type="datetime-local"
                value={repeatUntilLocal}
                disabled={!frequencyMinutes}
                onChange={(e) => setRepeatUntilLocal(e.target.value)}
                aria-label="Repeat until"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] text-muted-foreground">
                {frequencyMinutes
                  ? `From ${formatWat(fromWatLocalInput(dueLocals[0]))} until ${formatWat(
                      fromWatLocalInput(repeatUntilLocal),
                    )}, every ${frequencyMinutes}m.`
                  : "Pick a cadence to generate multiple reminders across the day."}
              </p>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={!frequencyMinutes}
                onClick={generateFromFrequency}
              >
                Generate slots
              </Button>
            </div>
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
