import { auth } from "@crm-tool/auth";
import type { Role } from "@crm-tool/db";
import { headers } from "next/headers";

import { KpiBoard } from "@/components/ops/kpi-board";
import { getKpiBoard } from "@/lib/queries/kpi";
import { can } from "@/lib/rbac";

/**
 * Company KPI Board (Module J, KPI-01..04). Visible to ALL authenticated users
 * (route guarded by the dashboard layout). Editing targets requires the
 * `set_kpi_targets` capability (Admin/Manager).
 */
export default async function KpiPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const roles = ((session?.user as { roles?: Role[] } | undefined)?.roles ?? []) as Role[];
  const canEdit = can(roles, "set_kpi_targets");

  const kpis = await getKpiBoard();

  return <KpiBoard initialKpis={kpis} canEdit={canEdit} />;
}
