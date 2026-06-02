"use client";

import { Star } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { clearKpiVote, voteKpi } from "@/lib/actions/kpi-vote";
import type { KpiVoteSummary } from "@/lib/queries/kpi-shared";

/**
 * 5-star rating control for KPI performance. Click a star to vote (or change
 * your vote); click your current rating again to clear it. Shows the team
 * average + voter count next to the stars.
 */
export function KpiVote({
  kpiId,
  summary,
  onChanged,
}: {
  kpiId: string;
  summary: KpiVoteSummary;
  onChanged?: () => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const my = summary.myRating;
  const display = hover ?? my ?? 0;

  function cast(rating: number) {
    if (pending) return;
    startTransition(async () => {
      const res =
        rating === my ? await clearKpiVote(kpiId) : await voteKpi(kpiId, rating);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to record vote");
        return;
      }
      toast.success(rating === my ? "Vote removed" : `Rated ${rating}/5`);
      onChanged?.();
    });
  }

  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <div
        className="flex items-center gap-0.5"
        onMouseLeave={() => setHover(null)}
        role="radiogroup"
        aria-label="Rate this KPI"
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const active = n <= display;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={my === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              disabled={pending}
              onMouseEnter={() => setHover(n)}
              onFocus={() => setHover(n)}
              onBlur={() => setHover(null)}
              onClick={() => cast(n)}
              className="rounded-sm p-0.5 outline-none transition-colors hover:text-yellow-500 focus-visible:ring-1 focus-visible:ring-ring/50 disabled:opacity-50"
            >
              <Star
                className={
                  "size-4 " +
                  (active
                    ? "fill-yellow-400 text-yellow-500"
                    : "text-muted-foreground")
                }
              />
            </button>
          );
        })}
      </div>
      <div className="text-muted-foreground tabular-nums">
        {summary.count === 0
          ? "No votes yet"
          : `${summary.average?.toFixed(1)} avg · ${summary.count} vote${summary.count === 1 ? "" : "s"}`}
      </div>
    </div>
  );
}
