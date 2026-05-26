import { cn } from "@crm-tool/ui/lib/utils";

/**
 * Simple actual-vs-target progress indicator for the KPI board (KPI-03).
 * Colour ramps red → amber → emerald as progress approaches the target.
 */
export function ProgressBar({ pct }: { pct: number | null }) {
  if (pct === null) {
    return (
      <div className="h-2 w-full rounded-none bg-muted">
        <div className="h-2 w-0 rounded-none" />
      </div>
    );
  }
  const tone =
    pct >= 100
      ? "bg-emerald-500"
      : pct >= 60
        ? "bg-amber-500"
        : "bg-destructive";
  return (
    <div
      className="h-2 w-full rounded-none bg-muted"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-2 rounded-none transition-all", tone)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
