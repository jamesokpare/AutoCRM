"use client";

import { Button } from "@crm-tool/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteKpi, fetchKpiBoard } from "@/lib/actions/kpi";
import type { KpiView } from "@/lib/queries/kpi-shared";

import { KpiCard } from "./kpi-card";
import { KpiForm } from "./kpi-form";

export function KpiBoard({
  initialKpis,
  canEdit,
}: {
  initialKpis: KpiView[];
  canEdit: boolean;
}) {
  const { data: kpis = initialKpis, refetch } = useQuery({
    queryKey: ["kpi-board"],
    queryFn: () => fetchKpiBoard(),
    initialData: initialKpis,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<KpiView | null>(null);
  const [deleting, startDelete] = useTransition();

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(kpi: KpiView) {
    setEditing(kpi);
    setFormOpen(true);
  }
  function remove(id: string) {
    startDelete(async () => {
      const res = await deleteKpi(id);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to delete");
        return;
      }
      toast.success("KPI deleted");
      refetch();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Company KPI Board</h1>
          <p className="text-xs text-muted-foreground">
            Actual vs. target across the company. Auto KPIs recompute on load.
          </p>
        </div>
        {canEdit ? (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" /> New KPI
          </Button>
        ) : null}
      </div>

      {kpis.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No KPI targets yet.{canEdit ? " Create one to start tracking." : ""}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {kpis.map((kpi) => (
            <KpiCard
              key={kpi.id}
              kpi={kpi}
              canEdit={canEdit}
              onEdit={openEdit}
              onDelete={remove}
              deleting={deleting}
            />
          ))}
        </div>
      )}

      {canEdit ? (
        <KpiForm
          open={formOpen}
          onOpenChange={setFormOpen}
          editing={editing}
          onSaved={() => refetch()}
        />
      ) : null}
    </div>
  );
}
