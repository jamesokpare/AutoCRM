"use client";

import { Channel } from "@crm-tool/db/enums";
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

import { createClient, updateClient } from "@/lib/actions/clients";

export interface ClientFormValues {
  id?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  preferredChannel?: Channel | null;
}

/**
 * CLT-01: create or edit a client. Renders a trigger button + dialog form.
 * Submits to the createClient / updateClient server actions.
 */
export function ClientForm({
  trigger,
  initial,
}: {
  trigger: React.ReactElement;
  initial?: ClientFormValues;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = isEdit
        ? await updateClient(initial!.id!, form)
        : await createClient(form);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to save client.");
        return;
      }
      toast.success(isEdit ? "Client updated" : "Client created");
      setOpen(false);
      if (!isEdit && res.data) {
        router.push(`/clients/${res.data.id}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit client" : "New client"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Field label="Name" name="name" defaultValue={initial?.name} required />
          <Field label="Phone" name="phone" defaultValue={initial?.phone ?? ""} />
          <Field label="Email" name="email" type="email" defaultValue={initial?.email ?? ""} />
          <Field label="WhatsApp" name="whatsapp" defaultValue={initial?.whatsapp ?? ""} />
          <Field label="Address" name="address" defaultValue={initial?.address ?? ""} />
          <div className="flex flex-col gap-1">
            <Label htmlFor="preferredChannel">Preferred channel</Label>
            <select
              id="preferredChannel"
              name="preferredChannel"
              defaultValue={initial?.preferredChannel ?? ""}
              className="h-8 rounded-none border border-input bg-transparent px-2.5 text-xs"
            >
              <option value="">None</option>
              {Object.values(Channel).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={name}>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} required={required} />
    </div>
  );
}
