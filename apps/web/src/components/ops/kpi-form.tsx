"use client";

import { Button } from "@crm-tool/ui/components/button";
import { Checkbox } from "@crm-tool/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@crm-tool/ui/components/dialog";
import { Input } from "@crm-tool/ui/components/input";
import { Label } from "@crm-tool/ui/components/label";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { createKpi, updateKpi } from "@/lib/actions/kpi";
import type { KpiInput } from "@/lib/actions/kpi-types";
import { detectAutoSource, type KpiView } from "@/lib/queries/kpi-shared";

/** Local YYYY-MM-DD from an ISO string (date-only input). */
function toDateInput(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function KpiForm({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this KPI; otherwise it creates a new one. */
  editing: KpiView | null;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [unit, setUnit] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [autoComputed, setAutoComputed] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setTargetValue(String(editing.targetValue));
      setCurrentValue(editing.actualValue !== null && !editing.autoComputed ? String(editing.actualValue) : "");
      setUnit(editing.unit ?? "");
      setPeriodStart(toDateInput(editing.periodStart));
      setPeriodEnd(toDateInput(editing.periodEnd));
      setAutoComputed(editing.autoComputed);
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setName("");
      setTargetValue("");
      setCurrentValue("");
      setUnit("");
      setPeriodStart(today);
      setPeriodEnd(today);
      setAutoComputed(false);
    }
  }, [open, editing]);

  const autoEligible = detectAutoSource(name) !== null;

  function submit() {
    const input: KpiInput = {
      name,
      targetValue: Number(targetValue),
      unit: unit || null,
      // Date-only inputs → treat as midnight UTC for the effective period.
      periodStart: new Date(`${periodStart}T00:00:00.000Z`).toISOString(),
      periodEnd: new Date(`${periodEnd}T23:59:59.999Z`).toISOString(),
      currentValue: currentValue === "" ? null : Number(currentValue),
      autoComputed: autoEligible ? autoComputed : false,
    };
    startTransition(async () => {
      const res = editing ? await updateKpi(editing.id, input) : await createKpi(input);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to save KPI");
        return;
      }
      toast.success(editing ? "KPI updated" : "KPI created");
      onOpenChange(false);
      onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit KPI target" : "New KPI target"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="kpi-name">Name</Label>
            <Input
              id="kpi-name"
              value={name}
              placeholder="e.g. Completed jobs this week"
              onChange={(e) => setName(e.target.value)}
            />
            {autoEligible ? (
              <span className="text-xs text-muted-foreground">
                This name maps to an auto-computed source.
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="kpi-target">Target value</Label>
              <Input
                id="kpi-target"
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="kpi-unit">Unit (optional)</Label>
              <Input
                id="kpi-unit"
                value={unit}
                placeholder="e.g. jobs, ★"
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="kpi-start">Period start</Label>
              <Input
                id="kpi-start"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="kpi-end">Period end</Label>
              <Input
                id="kpi-end"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>

          {autoEligible ? (
            <label className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={autoComputed}
                onCheckedChange={(c) => setAutoComputed(Boolean(c))}
              />
              Auto-compute actual on load
            </label>
          ) : null}

          {!autoComputed ? (
            <div className="flex flex-col gap-1">
              <Label htmlFor="kpi-current">Current actual (manual, optional)</Label>
              <Input
                id="kpi-current"
                type="number"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
              />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={pending} onClick={submit}>
            {editing ? "Save changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
