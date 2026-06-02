"use client";

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
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteAllClients } from "@/lib/actions/clients";

const CONFIRM_PHRASE = "DELETE ALL CLIENTS";

/**
 * Destructive bulk action: wipes every client (and all cascaded records). Hidden
 * behind a typed-confirmation guard — the Delete button stays disabled until
 * the user types the exact phrase. The server action enforces the same phrase
 * server-side so a stray click can't trigger the wipe.
 */
export function ClientBulkDeleteDialog({ trigger }: { trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const armed = phrase.trim() === CONFIRM_PHRASE;

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setPhrase("");
  }

  function onConfirm() {
    if (!armed) return;
    startTransition(async () => {
      const res = await deleteAllClients(CONFIRM_PHRASE);
      if (!res.ok || !res.data) {
        toast.error(res.error ?? "Bulk delete failed.");
        return;
      }
      const { deleted } = res.data;
      toast.success(
        deleted === 0
          ? "No clients to delete."
          : `Deleted ${deleted} client${deleted === 1 ? "" : "s"} and all related records.`,
      );
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete all clients?</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            This permanently removes <strong>every client</strong> and all related vehicles,
            orders, parts, feedback, communications, reminders and daily updates. This cannot be
            undone.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bulkDeleteConfirm" className="text-xs">
              Type <code>{CONFIRM_PHRASE}</code> to confirm
            </Label>
            <Input
              id="bulkDeleteConfirm"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              autoComplete="off"
              className="font-mono text-xs"
              placeholder={CONFIRM_PHRASE}
            />
          </div>
        </div>
        <DialogFooter>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={!armed || pending}
            onClick={onConfirm}
          >
            {pending ? "Deleting…" : "Delete all clients"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
