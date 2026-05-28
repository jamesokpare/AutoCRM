"use client";

import { Channel, OrderStatus, PartAvailability } from "@crm-tool/db/enums";
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
import { Textarea } from "@crm-tool/ui/components/textarea";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createClientFull } from "@/lib/actions/clients";

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  FAILED: "Failed",
  ON_HOLD: "On Hold",
};

const PART_LABEL: Record<PartAvailability, string> = {
  AVAILABLE: "Available",
  ON_ORDER: "On order",
  NOT_AVAILABLE: "Not available",
};

const REASON_STATUSES: OrderStatus[] = [OrderStatus.FAILED, OrderStatus.ON_HOLD];

interface PartRow {
  name: string;
  availability: PartAvailability;
}

const selectClass = "h-8 rounded-none border border-input bg-transparent px-2.5 text-xs";

/**
 * Full client intake: captures the client plus, optionally, a first vehicle and
 * order (status, parts + availability, expected date, assigned technician) in
 * one submission. Open to every signed-in team member.
 */
export function ClientIntakeForm({
  trigger,
}: {
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<OrderStatus>(OrderStatus.PENDING);
  const [parts, setParts] = useState<PartRow[]>([]);
  const router = useRouter();

  function reset() {
    setStatus(OrderStatus.PENDING);
    setParts([]);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createClientFull(form);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to create client.");
        return;
      }
      toast.success("Client created");
      setOpen(false);
      reset();
      if (res.data) router.push(`/clients/${res.data.id}`);
      else router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New client</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {/* Client */}
          <Section title="Client">
            <Field label="Name" name="name" required />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone" name="phone" />
              <Field label="Email" name="email" type="email" />
              <Field label="WhatsApp" name="whatsapp" />
              <Field label="Address" name="address" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="preferredChannel">Preferred channel</Label>
              <select id="preferredChannel" name="preferredChannel" defaultValue="" className={selectClass}>
                <option value="">None</option>
                {Object.values(Channel).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </Section>

          {/* Vehicle */}
          <Section title="Vehicle" hint="Optional — fill make, model and year to add a vehicle.">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Make" name="make" />
              <Field label="Model" name="model" />
              <Field label="Year" name="year" type="number" />
              <Field label="Plate" name="plate" />
              <Field label="VIN" name="vin" />
              <Field label="Color" name="color" />
              <Field label="Mileage" name="mileage" type="number" />
            </div>
          </Section>

          {/* Order */}
          <Section title="Order" hint="Optional — needs a vehicle above. Describe the job to add an order.">
            <div className="flex flex-col gap-1">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  name="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as OrderStatus)}
                  className={selectClass}
                >
                  {Object.values(OrderStatus).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="assignedTechName">Technician</Label>
                <Input id="assignedTechName" name="assignedTechName" placeholder="Technician name" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="receivedDate">Received</Label>
                <Input id="receivedDate" name="receivedDate" type="date" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="expectedDate">Expected completion</Label>
                <Input id="expectedDate" name="expectedDate" type="date" />
              </div>
            </div>

            {REASON_STATUSES.includes(status) ? (
              <div className="flex flex-col gap-1">
                <Label htmlFor="statusReason">
                  Reason (required for {STATUS_LABEL[status]})
                </Label>
                <Textarea id="statusReason" name="statusReason" rows={2} />
              </div>
            ) : null}

            {/* Parts with availability */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label>Parts</Label>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() =>
                    setParts((p) => [...p, { name: "", availability: PartAvailability.NOT_AVAILABLE }])
                  }
                >
                  <Plus className="size-3.5" /> Add part
                </Button>
              </div>
              {parts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No parts added.</p>
              ) : (
                parts.map((part, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Input
                      name="partName"
                      value={part.name}
                      onChange={(e) =>
                        setParts((p) =>
                          p.map((row, j) => (j === i ? { ...row, name: e.target.value } : row)),
                        )
                      }
                      placeholder="Part name"
                      className="h-8 flex-1"
                    />
                    <select
                      name="partAvailability"
                      value={part.availability}
                      onChange={(e) =>
                        setParts((p) =>
                          p.map((row, j) =>
                            j === i ? { ...row, availability: e.target.value as PartAvailability } : row,
                          ),
                        )
                      }
                      className={selectClass}
                    >
                      {Object.values(PartAvailability).map((a) => (
                        <option key={a} value={a}>
                          {PART_LABEL[a]}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Remove part"
                      onClick={() => setParts((p) => p.filter((_, j) => j !== i))}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </Section>

          <DialogFooter>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Create client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-none border border-border p-3">
      <legend className="px-1 text-xs font-medium text-muted-foreground">{title}</legend>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {children}
    </fieldset>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={name}>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input id={name} name={name} type={type} required={required} />
    </div>
  );
}
