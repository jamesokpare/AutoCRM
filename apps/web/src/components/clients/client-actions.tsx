"use client";

import { ClientStatus, ServiceStatus } from "@crm-tool/db/enums";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@crm-tool/ui/components/select";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteClient,
  setClientServiceStatus,
  setClientServiceStatusCustom,
  setClientStatus,
} from "@/lib/actions/clients";

const STATUS_OPTIONS: { value: ClientStatus; label: string }[] = [
  { value: ClientStatus.PROSPECT, label: "Prospect" },
  { value: ClientStatus.ACTIVE, label: "Active" },
  { value: ClientStatus.INACTIVE, label: "Inactive" },
  { value: ClientStatus.ARCHIVED, label: "Archived" },
];

export function ClientStatusControl({
  clientId,
  current,
}: {
  clientId: string;
  current: ClientStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Select
      items={STATUS_OPTIONS}
      value={current}
      onValueChange={(value) => {
        const next = value as ClientStatus;
        if (next === current) return;
        startTransition(async () => {
          const res = await setClientStatus(clientId, next);
          if (!res.ok) {
            toast.error(res.error ?? "Failed to update status.");
            return;
          }
          toast.success("Client status updated");
          router.refresh();
        });
      }}
    >
      <SelectTrigger className="h-8 w-36" disabled={pending}>
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
  );
}

// "None" clears the manual service status; Select can't hold an empty value, so
// we model "unset" as an explicit sentinel option.
const SERVICE_STATUS_NONE = "NONE";
const SERVICE_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: SERVICE_STATUS_NONE, label: "No service status" },
  { value: ServiceStatus.PENDING, label: "Pending" },
  { value: ServiceStatus.IN_PROGRESS, label: "In Progress" },
  { value: ServiceStatus.COMPLETED, label: "Completed" },
  { value: ServiceStatus.FAILED, label: "Failed" },
  { value: ServiceStatus.ON_HOLD, label: "On Hold" },
  { value: ServiceStatus.DUE_TODAY, label: "Due today" },
  { value: ServiceStatus.PARTS_NOT_AVAILABLE, label: "Parts not available" },
];

/**
 * CLT: manual, client-level service status. Offers the five real statuses plus
 * the two derived dashboard buckets (Due today, Parts not available) and a
 * "None" option to clear it. Unlike the order status, it lives on the client,
 * so it filters even for clients with no orders. Reflected in the dashboard
 * filters (status dropdown + quick filters).
 */
export function ClientServiceStatusControl({
  clientId,
  current,
}: {
  clientId: string;
  current: ServiceStatus | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Select
      items={SERVICE_STATUS_OPTIONS}
      value={current ?? SERVICE_STATUS_NONE}
      onValueChange={(value) => {
        const next = value === SERVICE_STATUS_NONE ? null : (value as ServiceStatus);
        if (next === (current ?? null)) return;
        startTransition(async () => {
          const res = await setClientServiceStatus(clientId, next);
          if (!res.ok) {
            toast.error(res.error ?? "Failed to update status.");
            return;
          }
          toast.success("Service status updated");
          router.refresh();
        });
      }}
    >
      <SelectTrigger className="h-8 w-48" disabled={pending} aria-label="Service status">
        <SelectValue placeholder="Service status" />
      </SelectTrigger>
      <SelectContent>
        {SERVICE_STATUS_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Free-text service status input — sits next to `ClientServiceStatusControl`
 * and lets the user type a status that doesn't fit the fixed enum (e.g.
 * "Awaiting customer approval"). Saved on blur or Enter; cleared by emptying
 * the field. Takes precedence over the enum for badge display.
 */
export function ClientServiceStatusCustomControl({
  clientId,
  current,
}: {
  clientId: string;
  current: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    const next = value.trim();
    if (next === (current ?? "")) return;
    startTransition(async () => {
      const res = await setClientServiceStatusCustom(clientId, next || null);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to update status.");
        return;
      }
      toast.success(next ? "Custom status updated" : "Custom status cleared");
      router.refresh();
    });
  }

  return (
    <Input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="Custom status…"
      disabled={pending}
      maxLength={80}
      aria-label="Custom service status"
      className="h-8 w-48"
    />
  );
}

/**
 * Delete-client icon button. Opens a confirmation dialog because deletion
 * cascades vehicles/orders/parts/feedback/communications via the schema.
 * Redirects to /clients on success.
 */
export function ClientDeleteButton({
  clientId,
  clientName,
  size = "sm",
}: {
  clientId: string;
  clientName: string;
  size?: "xs" | "sm";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size={size === "xs" ? "icon-sm" : "icon-sm"}
            variant="outline"
            aria-label="Delete client"
            title="Delete client"
          >
            <Trash2 className="size-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {clientName}?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This permanently removes the client and all related vehicles, orders,
          parts, feedback, communications and reminders. This cannot be undone.
        </p>
        <DialogFooter>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await deleteClient(clientId);
                if (!res.ok) {
                  toast.error(res.error ?? "Failed to delete client.");
                  return;
                }
                toast.success("Client deleted");
                setOpen(false);
                router.push("/clients");
                router.refresh();
              })
            }
          >
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Compact delete icon for table rows — does not redirect, just refreshes the
 * current route.
 */
export function ClientRowDeleteButton({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Delete client"
            title="Delete client"
          >
            <Trash2 className="size-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {clientName}?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This permanently removes the client and all related records. This
          cannot be undone.
        </p>
        <DialogFooter>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await deleteClient(clientId);
                if (!res.ok) {
                  toast.error(res.error ?? "Failed to delete client.");
                  return;
                }
                toast.success("Client deleted");
                setOpen(false);
                router.refresh();
              })
            }
          >
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
