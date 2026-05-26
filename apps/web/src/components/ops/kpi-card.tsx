"use client";

import { Badge } from "@crm-tool/ui/components/badge";
import { Button } from "@crm-tool/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@crm-tool/ui/components/card";
import { Pencil, Trash2 } from "lucide-react";

import type { KpiView } from "@/lib/queries/kpi-shared";
import { formatWatDate } from "@/components/ops/wat";

import { ProgressBar } from "./progress-bar";

function formatVal(v: number | null, unit: string | null): string {
  if (v === null) return "—";
  const num = Number.isInteger(v) ? String(v) : v.toFixed(2);
  return unit ? `${num} ${unit}` : num;
}

export function KpiCard({
  kpi,
  canEdit,
  onEdit,
  onDelete,
  deleting,
}: {
  kpi: KpiView;
  canEdit: boolean;
  onEdit?: (kpi: KpiView) => void;
  onDelete?: (id: string) => void;
  deleting?: boolean;
}) {
  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="truncate">{kpi.name}</span>
          {kpi.autoComputed ? (
            <Badge variant="secondary" title="Actual computed automatically on load">
              Auto
            </Badge>
          ) : (
            <Badge variant="outline">Manual</Badge>
          )}
        </CardTitle>
        <CardDescription>
          {formatWatDate(kpi.periodStart)} – {formatWatDate(kpi.periodEnd)} (WAT)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-base font-semibold tabular-nums">
            {formatVal(kpi.actualValue, kpi.unit)}
          </span>
          <span className="text-muted-foreground">
            target {formatVal(kpi.targetValue, kpi.unit)}
          </span>
        </div>
        <ProgressBar pct={kpi.progressPct} />
        <div className="text-muted-foreground">
          {kpi.progressPct === null
            ? "No actual recorded yet"
            : `${kpi.progressPct}% of target`}
        </div>
      </CardContent>
      {canEdit ? (
        <CardFooter className="justify-end gap-1.5">
          <Button size="xs" variant="outline" onClick={() => onEdit?.(kpi)}>
            <Pencil className="size-3" /> Edit
          </Button>
          <Button
            size="xs"
            variant="destructive"
            disabled={deleting}
            onClick={() => onDelete?.(kpi.id)}
          >
            <Trash2 className="size-3" /> Delete
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}
