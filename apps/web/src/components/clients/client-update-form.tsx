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
import { Label } from "@crm-tool/ui/components/label";
import { Textarea } from "@crm-tool/ui/components/textarea";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { addClientUpdate, updateClientUpdate } from "@/lib/actions/client-updates";

/**
 * Add or edit a daily client update. Open to every signed-in team member.
 * Pass `update` to edit an existing note; omit it to add a new one.
 */
export function ClientUpdateForm({
  clientId,
  trigger,
  update,
}: {
  clientId: string;
  trigger: React.ReactElement;
  update?: { id: string; note: string };
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(update?.note ?? "");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const isEdit = Boolean(update?.id);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const clean = note.trim();
    if (!clean) return;
    startTransition(async () => {
      const res = isEdit
        ? await updateClientUpdate(update!.id, clean)
        : await addClientUpdate(clientId, clean);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to save update.");
        return;
      }
      toast.success(isEdit ? "Update edited" : "Update added");
      setOpen(false);
      if (!isEdit) setNote("");
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setNote(update?.note ?? "");
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit daily update" : "Add daily update"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="note">Update</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="What changed for this client today?"
            />
          </div>
          <DialogFooter>
            <Button type="submit" size="sm" disabled={pending || !note.trim()}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
