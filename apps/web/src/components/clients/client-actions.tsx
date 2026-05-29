"use client";

import { ClientStatus } from "@crm-tool/db/enums";
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
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteClient, setClientStatus } from "@/lib/actions/clients";

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
