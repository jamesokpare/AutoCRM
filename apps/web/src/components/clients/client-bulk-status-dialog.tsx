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
import { Label } from "@crm-tool/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@crm-tool/ui/components/select";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setClientStatusBulk } from "@/lib/actions/clients";

const STATUS_OPTIONS: { value: ClientStatus; label: string }[] = [
  { value: ClientStatus.PROSPECT, label: "Prospect" },
  { value: ClientStatus.ACTIVE, label: "Active" },
  { value: ClientStatus.INACTIVE, label: "Inactive" },
  { value: ClientStatus.ARCHIVED, label: "Archived" },
];

/**
 * Bulk client-status dialog. Drives `setClientStatusBulk` over the IDs picked
 * in the client table. Doesn't manage selection itself — the parent passes the
 * ids and clears them on success.
 */
export function ClientBulkStatusDialog({
  trigger,
  clientIds,
  onApplied,
}: {
  trigger: React.ReactElement;
  clientIds: string[];
  onApplied?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ClientStatus>(ClientStatus.ACTIVE);
  const [pending, startTransition] = useTransition();
  const count = clientIds.length;

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) setStatus(ClientStatus.ACTIVE);
  }

  function apply() {
    if (count === 0) {
      toast.error("No clients selected.");
      return;
    }
    startTransition(async () => {
      const res = await setClientStatusBulk(clientIds, status);
      if (!res.ok || !res.data) {
        toast.error(res.error ?? "Bulk status update failed.");
        return;
      }
      toast.success(
        `Updated status on ${res.data.updated} ${res.data.updated === 1 ? "client" : "clients"}.`,
      );
      setOpen(false);
      onApplied?.();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Set status on {count} {count === 1 ? "client" : "clients"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Overwrites the relationship status (Prospect / Active / Inactive / Archived)
            on every selected client. The previous values are not restorable.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bulkStatus" className="text-xs">
              New status
            </Label>
            <Select
              items={STATUS_OPTIONS}
              value={status}
              onValueChange={(v) => setStatus(v as ClientStatus)}
            >
              <SelectTrigger id="bulkStatus" className="h-8 w-48">
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
          </div>
        </div>
        <DialogFooter>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={pending || count === 0} onClick={apply}>
            {pending ? "Updating…" : `Apply to ${count}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
