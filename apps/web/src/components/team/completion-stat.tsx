import { cn } from "@crm-tool/ui/lib/utils";

import { PersonAvatar } from "./person-avatar";
import type { PersonDTO } from "./types";

export interface CompletionStatDTO {
  person: PersonDTO;
  total: number;
  completed: number;
  failed: number;
  pct: number;
}

/** ACC-04: per-person weekly completion %, rendered as a small progress card. */
export function CompletionStat({ stat }: { stat: CompletionStatDTO }) {
  return (
    <div className="flex flex-col gap-2 border border-border bg-card p-3 text-xs">
      <div className="flex items-center gap-2">
        <PersonAvatar person={stat.person} />
        <span className="truncate font-medium">{stat.person.name}</span>
        <span className="ml-auto font-semibold tabular-nums">{stat.pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden bg-muted">
        <div
          className={cn(
            "h-full",
            stat.pct >= 75 ? "bg-emerald-500" : stat.pct >= 40 ? "bg-amber-500" : "bg-destructive",
          )}
          style={{ width: `${stat.pct}%` }}
        />
      </div>
      <p className="text-muted-foreground">
        {stat.completed}/{stat.total} completed
        {stat.failed > 0 ? ` · ${stat.failed} failed` : ""}
      </p>
    </div>
  );
}
