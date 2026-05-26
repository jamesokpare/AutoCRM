import { ClientTable } from "@/components/clients/client-table";
import { SummaryStrip } from "@/components/clients/summary-strip";
import { getClientList, getDashboardSummary } from "@/lib/queries/clients";

/**
 * DASH-01..06: shared client dashboard overview. Summary strip + the client
 * list with vehicle / order summary / status / parts / expected / tech / last
 * update, plus quick filters. Server component fetches initial data directly;
 * the table refetches on window focus via TanStack Query (SPEC §2 — no push).
 */
export default async function DashboardPage() {
  const [summary, clients] = await Promise.all([getDashboardSummary(), getClientList()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <p className="text-xs text-muted-foreground">
          Live overview of all active jobs across the workshop.
        </p>
      </div>

      <SummaryStrip summary={summary} />

      <ClientTable initialData={clients} />
    </div>
  );
}
