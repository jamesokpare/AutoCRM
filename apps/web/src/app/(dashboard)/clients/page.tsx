import { Button } from "@crm-tool/ui/components/button";

import { ClientImportDialog } from "@/components/clients/client-import-dialog";
import { ClientIntakeForm } from "@/components/clients/client-intake-form";
import { ClientTable } from "@/components/clients/client-table";
import { getClientList } from "@/lib/queries/clients";

/**
 * CLT / Module B: client directory. Lists all clients with the same searchable
 * table the dashboard uses. Creating a client — including its first vehicle and
 * order — is open to every signed-in team member.
 */
export default async function ClientsPage() {
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
        <div className="flex items-center gap-2">
          <ClientImportDialog
            trigger={
              <Button size="sm" variant="outline">
                Import
              </Button>
            }
          />
          <ClientIntakeForm trigger={<Button size="sm">New client</Button>} />
        </div>
      </div>

      <ClientTable initialData={clients} />
    </div>
  );
}
