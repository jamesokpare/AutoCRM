import { KpiBoard } from "@/components/ops/kpi-board";
import { getKpiBoard } from "@/lib/queries/kpi";

/**
 * Company KPI Board (Module J, KPI-01..04). Visible to ALL authenticated users
 * (route guarded by the dashboard layout). Creating / editing KPIs is open to
 * every signed-in team member.
 */
export default async function KpiPage() {
  const kpis = await getKpiBoard();

  return <KpiBoard initialKpis={kpis} canEdit />;
}
