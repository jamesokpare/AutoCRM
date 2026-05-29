"use client";

import { OrderStatus, PartAvailability } from "@crm-tool/db/enums";
import { Button } from "@crm-tool/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@crm-tool/ui/components/dialog";
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

import { Input } from "@crm-tool/ui/components/input";

import { addPart, setOrderStatus, setPartAvailability } from "@/lib/actions/orders";

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  FAILED: "Failed",
  ON_HOLD: "On Hold",
};

const REQUIRES_REASON: OrderStatus[] = [OrderStatus.FAILED, OrderStatus.ON_HOLD];

// Enum declaration order (Pending → In Progress → Completed → Failed → On Hold).
const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = Object.values(OrderStatus).map(
  (value) => ({ value, label: STATUS_LABEL[value] }),
);

/**
 * CLT-07 status control. Requires `update_job_status` (caller decides whether
 * to render it). Rendered as a dropdown toggle. A reason is collected and
 * required when moving to FAILED or ON_HOLD — the action also enforces this
 * server-side.
 */
export function StatusControl({
  orderId,
  current,
}: {
  orderId: string;
  current: OrderStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [reasonOpen, setReasonOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
  const [reason, setReason] = useState("");
  const router = useRouter();

  function apply(status: OrderStatus, reasonText?: string) {
    startTransition(async () => {
      const res = await setOrderStatus(orderId, status, reasonText);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to update status.");
        return;
      }
      toast.success("Status updated");
      setReasonOpen(false);
      setReason("");
      router.refresh();
    });
  }

  function onPick(status: OrderStatus) {
    if (status === current) return;
    if (REQUIRES_REASON.includes(status)) {
      setPendingStatus(status);
      setReasonOpen(true);
      return;
    }
    apply(status);
  }

  return (
    <>
      <Select
        items={STATUS_OPTIONS}
        value={current}
        onValueChange={(value) => onPick(value as OrderStatus)}
      >
        <SelectTrigger className="h-8 w-40" disabled={pending} aria-label="Job status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Reason required for {pendingStatus ? STATUS_LABEL[pendingStatus] : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <Label htmlFor="statusReason">Why is this order {pendingStatus === OrderStatus.FAILED ? "failed" : "on hold"}?</Label>
            <Textarea
              id="statusReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              size="sm"
              disabled={pending || !reason.trim() || !pendingStatus}
              onClick={() => pendingStatus && apply(pendingStatus, reason)}
            >
              {pending ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const PART_LABEL: Record<PartAvailability, string> = {
  AVAILABLE: "Available",
  NOT_AVAILABLE: "Not available",
  ON_ORDER: "On order",
};

/** CLT-08 part availability control. Requires `update_parts`. */
export function PartControl({
  partId,
  current,
}: {
  partId: string;
  current: PartAvailability;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <select
      value={current}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as PartAvailability;
        startTransition(async () => {
          const res = await setPartAvailability(partId, next);
          if (!res.ok) {
            toast.error(res.error ?? "Failed to update part.");
            return;
          }
          toast.success("Part updated");
          router.refresh();
        });
      }}
      className="h-7 rounded-none border border-input bg-transparent px-2 text-xs"
    >
      {Object.values(PartAvailability).map((a) => (
        <option key={a} value={a}>
          {PART_LABEL[a]}
        </option>
      ))}
    </select>
  );
}

/** CLT-08 add a part to an order. Requires `update_parts`. */
export function AddPart({ orderId }: { orderId: string }) {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    startTransition(async () => {
      const res = await addPart(orderId, clean);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to add part.");
        return;
      }
      toast.success("Part added");
      setName("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onAdd} className="flex items-center gap-1.5">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Add part…"
        className="h-7 max-w-[12rem]"
      />
      <Button type="submit" size="xs" variant="outline" disabled={pending || !name.trim()}>
        Add
      </Button>
    </form>
  );
}
