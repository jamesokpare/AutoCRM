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

import { addVehicle, updateVehicle } from "@/lib/actions/clients";

export interface VehicleInitial {
  id: string;
  make: string;
  model: string;
  year: number;
  plate?: string | null;
  vin?: string | null;
  color?: string | null;
  mileage?: number | null;
}

/** CLT-02: add or edit a vehicle for a client. */
export function VehicleForm({
  clientId,
  initial,
  trigger,
}: {
  clientId: string;
  initial?: VehicleInitial;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = isEdit ? await updateVehicle(initial!.id, form) : await addVehicle(clientId, form);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to save vehicle.");
        return;
      }
      toast.success(isEdit ? "Vehicle updated" : "Vehicle added");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit vehicle" : "Add vehicle"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Make" name="make" defaultValue={initial?.make} required />
            <Field label="Model" name="model" defaultValue={initial?.model} required />
            <Field
              label="Year"
              name="year"
              type="number"
              defaultValue={initial?.year?.toString()}
              required
            />
            <Field label="Plate" name="plate" defaultValue={initial?.plate ?? ""} />
            <Field label="VIN" name="vin" defaultValue={initial?.vin ?? ""} />
            <Field label="Color" name="color" defaultValue={initial?.color ?? ""} />
            <Field
              label="Mileage"
              name="mileage"
              type="number"
              defaultValue={initial?.mileage?.toString() ?? ""}
            />
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
