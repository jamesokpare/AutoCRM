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
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@crm-tool/ui/components/select";
import { Textarea } from "@crm-tool/ui/components/textarea";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Input } from "@crm-tool/ui/components/input";

import {
  addPart,
  markOrderDueToday,
  markOrderPartsNotAvailable,
  setOrderStatus,
  setPartAvailability,
} from "@/lib/actions/orders";

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  FAILED: "Failed",
  ON_HOLD: "On Hold",
  CUSTOMER_CANCELLED: "Customer cancelled",
};

const REQUIRES_REASON: OrderStatus[] = [OrderStatus.FAILED, OrderStatus.ON_HOLD];

// Enum declaration order (Pending → In Progress → Completed → Failed → On Hold).
const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = Object.values(OrderStatus).map(
  (value) => ({ value, label: STATUS_LABEL[value] }),
);

// "Due today" and "Parts not available" aren't stored order statuses — they're
// derived buckets on the dashboard filter. Selecting them performs the
// underlying change (sets the expected date to today / marks parts
// unavailable) so the order shows up under that dashboard filter. They never
// become the dropdown's selected value, which always reflects the real status.
const DUE_TODAY_VALUE = "__due_today__";
const PARTS_NA_VALUE = "__parts_not_available__";

/**
 * CLT-07 status control. Requires `update_job_status` (caller decides whether
 * to render it). Rendered as a dropdown toggle over the five real order
 * statuses plus two derived actions ("Due today", and — when the caller can
 * update parts — "Parts not available"). A reason is collected and required
 * when moving to FAILED or ON_HOLD — the action also enforces this server-side.
 */
export function StatusControl({
  orderId,
  current,
  canParts = false,
}: {
  orderId: string;
  current: OrderStatus;
  canParts?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [reasonOpen, setReasonOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
  const [reason, setReason] = useState("");
  const router = useRouter();

  const derivedOptions = [
    { value: DUE_TODAY_VALUE, label: "Due today" },
    ...(canParts ? [{ value: PARTS_NA_VALUE, label: "Parts not available" }] : []),
  ];
  const allOptions = [...STATUS_OPTIONS, ...derivedOptions];

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

  function runDerived(fn: () => Promise<{ ok: boolean; error?: string }>, successMsg: string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? "Failed to update.");
        return;
      }
      toast.success(successMsg);
      router.refresh();
    });
  }

  function onPick(value: string) {
    if (value === DUE_TODAY_VALUE) {
      runDerived(() => markOrderDueToday(orderId), "Marked due today");
      return;
    }
    if (value === PARTS_NA_VALUE) {
      runDerived(() => markOrderPartsNotAvailable(orderId), "Marked parts not available");
      return;
    }
    const status = value as OrderStatus;
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
        items={allOptions}
        value={current}
        onValueChange={(value) => onPick(value as string)}
      >
        <SelectTrigger className="h-8 w-44" disabled={pending} aria-label="Job status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
          <SelectSeparator />
          {derivedOptions.map((opt) => (
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
