"use client";

import { Badge } from "@crm-tool/ui/components/badge";
import { Button } from "@crm-tool/ui/components/button";
import { Check, X } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { completeReminder, dismissReminder } from "@/lib/actions/reminders";
import type { ReminderCentre, ReminderView } from "@/lib/queries/reminders";
import { formatWat } from "@/components/ops/wat";

function ReminderRow({
  r,
  onChanged,
}: {
  r: ReminderView;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function act(fn: (id: string) => Promise<{ ok: boolean; error?: string }>, ok: string) {
    startTransition(async () => {
      const res = await fn(r.id);
      if (!res.ok) {
        toast.error(res.error ?? "Failed");
        return;
      }
      toast.success(ok);
      onChanged();
    });
  }

  return (
    <div className="flex items-start justify-between gap-2 border-b py-2 last:border-b-0">
      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline">{r.type}</Badge>
          {r.recurrence ? <Badge variant="secondary">{r.recurrence}</Badge> : null}
        </div>
        <div className="truncate text-xs font-medium">{r.subject}</div>
        <div className="text-xs text-muted-foreground">
          Due {formatWat(r.dueAt)} (WAT)
          {r.assigneeName ? ` · ${r.assigneeName}` : " · Unassigned"}
        </div>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button
          size="xs"
          variant="outline"
          disabled={pending}
          onClick={() => act(completeReminder, "Marked done")}
        >
          <Check className="size-3" /> Done
        </Button>
        <Button
          size="xs"
          variant="ghost"
          disabled={pending}
          onClick={() => act(dismissReminder, "Dismissed")}
        >
          <X className="size-3" /> Dismiss
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  tone,
  items,
  onChanged,
}: {
  title: string;
  tone: "destructive" | "warning" | "default";
  items: ReminderView[];
  onChanged: () => void;
}) {
  const badgeVariant =
    tone === "destructive" ? "destructive" : tone === "warning" ? "warning" : "secondary";
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium">{title}</h2>
        <Badge variant={badgeVariant}>{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing here.</p>
      ) : (
        <div className="rounded-none ring-1 ring-foreground/10">
          <div className="px-3">
            {items.map((r) => (
              <ReminderRow key={r.id} r={r} onChanged={onChanged} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Renders a reminder centre's three WAT buckets (REM-08). */
export function ReminderList({
  centre,
  onChanged,
}: {
  centre: ReminderCentre;
  onChanged: () => void;
}) {
  return (
    <div className="space-y-4">
      <Section title="Overdue" tone="destructive" items={centre.overdue} onChanged={onChanged} />
      <Section title="Due today" tone="warning" items={centre.today} onChanged={onChanged} />
      <Section title="Upcoming" tone="default" items={centre.upcoming} onChanged={onChanged} />
    </div>
  );
}
