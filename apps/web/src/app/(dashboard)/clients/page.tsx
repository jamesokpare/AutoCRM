import { auth } from "@crm-tool/auth";
import type { Role } from "@crm-tool/db";
import { Button } from "@crm-tool/ui/components/button";
import { headers } from "next/headers";

import { ClientForm } from "@/components/clients/client-form";
import { ClientTable } from "@/components/clients/client-table";
import { getClientList } from "@/lib/queries/clients";
import { can } from "@/lib/rbac";

/**
 * CLT / Module B: client directory. Lists all clients with the same searchable
 * table the dashboard uses; "New client" is gated to users who can edit.
 */
export default async function ClientsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const roles = ((session?.user as { roles?: Role[] } | undefined)?.roles ?? []) as Role[];
  const canEdit = can(roles, "edit_clients_orders");

  const clients = await getClientList();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Clients</h1>
          <p className="text-xs text-muted-foreground">
            Search and manage clients, vehicles and service orders.
          </p>
        </div>
        {canEdit ? (
          <ClientForm trigger={<Button size="sm">New client</Button>} />
        ) : null}
      </div>

      <ClientTable initialData={clients} />
    </div>
  );
}
