import { Card } from "@crm-tool/ui/components/card";

import type { DashboardSummary } from "@/lib/queries/clients";

/** DASH-06 summary strip: at-a-glance counts across all jobs. */
export function SummaryStrip({ summary }: { summary: DashboardSummary }) {
  const items: { label: string; value: number; tone?: string }[] = [
    { label: "Active jobs", value: summary.activeJobs },
    { label: "Pending", value: summary.pending, tone: "text-amber-600 dark:text-amber-400" },
    {
      label: "In progress",
      value: summary.inProgress,
      tone: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Completed this week",
      value: summary.completedThisWeek,
      tone: "text-emerald-600 dark:text-emerald-400",
    },
    { label: "Failed", value: summary.failed, tone: "text-red-600 dark:text-red-400" },
    { label: "Awaiting parts", value: summary.awaitingParts },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <Card key={item.label} className="gap-1 p-3">
          <div className={`text-2xl font-semibold tabular-nums ${item.tone ?? ""}`}>
            {item.value}
          </div>
          <div className="text-xs text-muted-foreground">{item.label}</div>
        </Card>
      ))}
    </div>
  );
}
