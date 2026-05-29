"use client";

import { OrderStatus } from "@crm-tool/db/enums";
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
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createOrder, updateOrder } from "@/lib/actions/orders";

export interface VehicleOption {
  id: string;
  label: string;
}

export interface OrderInitial {
  id: string;
  description: string;
  vehicleId: string;
  receivedDate: string; // yyyy-mm-dd
  expectedDate?: string | null; // yyyy-mm-dd
  assignedTechName?: string | null;
}

/** CLT-03..06: create or edit a service order (with an optional parts list on create). */
export function OrderForm({
  clientId,
  vehicles,
  initial,
  trigger,
}: {
  clientId: string;
  vehicles: VehicleOption[];
  initial?: OrderInitial;
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
      const res = isEdit ? await updateOrder(initial!.id, form) : await createOrder(clientId, form);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to save order.");
        return;
      }
      toast.success(isEdit ? "Order updated" : "Order created");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit order" : "New order"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="vehicleId">Vehicle *</Label>
            <select
              id="vehicleId"
              name="vehicleId"
              defaultValue={initial?.vehicleId ?? vehicles[0]?.id ?? ""}
              required
              className="h-8 rounded-none border border-input bg-transparent px-2.5 text-xs"
            >
              {vehicles.length === 0 ? <option value="">Add a vehicle first</option> : null}
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="description">Description *</Label>
            <Textarea id="description" name="description" defaultValue={initial?.description} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="receivedDate">Received</Label>
              <Input
                id="receivedDate"
                name="receivedDate"
                type="date"
                defaultValue={initial?.receivedDate}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="expectedDate">Expected</Label>
              <Input
                id="expectedDate"
                name="expectedDate"
                type="date"
                defaultValue={initial?.expectedDate ?? ""}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="assignedTechName">Assigned technician</Label>
            <Input
              id="assignedTechName"
              name="assignedTechName"
              defaultValue={initial?.assignedTechName ?? ""}
              placeholder="Technician name"
            />
          </div>

          {!isEdit ? (
            <>
              <input type="hidden" name="status" value={OrderStatus.PENDING} />
              <div className="flex flex-col gap-1">
                <Label htmlFor="partNames">Parts (one per line)</Label>
                <PartsTextarea />
              </div>
            </>
          ) : null}

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

/**
 * A textarea that splits its lines into repeated `partName` form fields, so the
 * createOrder action can read them via `formData.getAll("partName")`.
 */
function PartsTextarea() {
  const [value, setValue] = useState("");
  const names = value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Brake pads&#10;Oil filter"
      />
      {names.map((n, i) => (
        <input key={`${n}-${i}`} type="hidden" name="partName" value={n} />
      ))}
    </>
  );
}
