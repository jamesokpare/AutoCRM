"use client";

import { Button } from "@crm-tool/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteKpi, fetchKpiBoard } from "@/lib/actions/kpi";
import {
  KPI_CATEGORY_SUGGESTIONS,
  KPI_UNCATEGORISED_LABEL,
  type KpiView,
} from "@/lib/queries/kpi-shared";

import { KpiCard } from "./kpi-card";
import { KpiForm } from "./kpi-form";

const selectClass =
  "h-8 rounded-none border border-input bg-transparent px-2.5 py-1 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 dark:bg-input/30";

const ALL = "__all__";

/**
 * Returns the de-duplicated, alphabetised list of category labels actually
 * present on the board, with any suggestion list options appended last so the
 * filter dropdown stays predictable across an empty / partially-populated
 * board. `null` categories render as `KPI_UNCATEGORISED_LABEL` in the UI but
 * are kept separate in the filter as the literal "Uncategorised" option.
 */
function categoriesPresent(kpis: KpiView[]): string[] {
  const seen = new Set<string>();
  for (const k of kpis) if (k.category) seen.add(k.category);
  const fromData = [...seen].sort((a, b) => a.localeCompare(b));
  // Suggestions append only if missing, so the dropdown always offers the
  // standard set even when no KPIs use them yet.
  for (const s of KPI_CATEGORY_SUGGESTIONS) {
    if (!seen.has(s)) fromData.push(s);
  }
  return fromData;
}

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
  /** Category filter: ALL = no filter; "" sentinel handled separately. */
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);
  /** When on, group cards under a heading per category. */
  const [groupByCategory, setGroupByCategory] = useState(false);

  const categories = useMemo(() => categoriesPresent(kpis), [kpis]);

  const filtered = useMemo(() => {
    if (categoryFilter === ALL) return kpis;
    if (categoryFilter === "") return kpis.filter((k) => !k.category);
    return kpis.filter((k) => k.category === categoryFilter);
  }, [kpis, categoryFilter]);

  const grouped = useMemo(() => {
    if (!groupByCategory) return null;
    const map = new Map<string, KpiView[]>();
    for (const k of filtered) {
      const key = k.category ?? KPI_UNCATEGORISED_LABEL;
      const arr = map.get(key) ?? [];
      arr.push(k);
      map.set(key, arr);
    }
    return [...map.entries()].sort(([a], [b]) => {
      // Push "Uncategorised" to the end for a cleaner reading order.
      if (a === KPI_UNCATEGORISED_LABEL) return 1;
      if (b === KPI_UNCATEGORISED_LABEL) return -1;
      return a.localeCompare(b);
    });
  }, [filtered, groupByCategory]);

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

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Category</span>
          <select
            className={selectClass}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by category"
          >
            <option value={ALL}>All</option>
            <option value="">{KPI_UNCATEGORISED_LABEL}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={groupByCategory}
            onChange={(e) => setGroupByCategory(e.target.checked)}
          />
          <span>Group by category</span>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {kpis.length === 0
            ? `No KPI targets yet.${canEdit ? " Create one to start tracking." : ""}`
            : "No KPIs match the current filter."}
        </p>
      ) : grouped ? (
        <div className="space-y-5">
          {grouped.map(([label, items]) => (
            <section key={label} className="space-y-2">
              <h2 className="text-sm font-medium">
                {label}{" "}
                <span className="text-muted-foreground">({items.length})</span>
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((kpi) => (
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
            </section>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((kpi) => (
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
