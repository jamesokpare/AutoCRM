import { auth } from "@crm-tool/auth";
import type { Role } from "@crm-tool/db";
import { Button } from "@crm-tool/ui/components/button";
import { headers } from "next/headers";

import { BulkMessageDialog } from "@/components/clients/bulk-message-dialog";
import { ClientBulkDeleteDialog } from "@/components/clients/client-bulk-delete-dialog";
import { ClientImportDialog } from "@/components/clients/client-import-dialog";
import { ClientIntakeForm } from "@/components/clients/client-intake-form";
import { ClientTable } from "@/components/clients/client-table";
import { getClientList } from "@/lib/queries/clients";
import { can } from "@/lib/rbac";

/**
 * CLT / Module B: client directory. Lists all clients with the same searchable
 * table the dashboard uses. Creating a client — including its first vehicle and
 * order — is open to every signed-in team member.
 */
export default async function ClientsPage() {
  const [clients, session] = await Promise.all([
    getClientList(),
    auth.api.getSession({ headers: await headers() }),
  ]);
  const roles = ((session?.user as { roles?: Role[] } | undefined)?.roles ?? []) as Role[];
  const canBulkSend = can(roles, "send_bulk_messages");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Clients</h1>
          <p className="text-xs text-muted-foreground">
            Search and manage clients, vehicles and service orders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canBulkSend && (
            <BulkMessageDialog
              trigger={
                <Button size="sm" variant="outline">
                  Bulk message
                </Button>
              }
            />
          )}
          <ClientImportDialog
            trigger={
              <Button size="sm" variant="outline">
                Import
              </Button>
            }
          />
          {clients.length > 0 && (
            <ClientBulkDeleteDialog
              trigger={
                <Button size="sm" variant="outline">
                  Delete all
                </Button>
              }
            />
          )}
          <ClientIntakeForm trigger={<Button size="sm">New client</Button>} />
        </div>
      </div>

      <ClientTable initialData={clients} canBulkSend={canBulkSend} />
    </div>
  );
}
