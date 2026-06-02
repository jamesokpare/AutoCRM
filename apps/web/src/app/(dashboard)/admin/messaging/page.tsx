import { auth } from "@crm-tool/auth";
import type { Role } from "@crm-tool/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getMessagingSettings } from "@/lib/actions/messaging";
import { can } from "@/lib/rbac";

import { MessagingSettingsForm } from "./messaging-settings-form";

/**
 * Admin-only configuration page for Drivewell's outbound messaging channels:
 * WhatsApp (Meta Cloud API) and Email (Resend). Used together with the
 * bulk-send dialog on the Clients page.
 */
export default async function AdminMessagingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const roles = ((session?.user as { roles?: Role[] } | undefined)?.roles ?? []) as Role[];
  if (!session?.user || !can(roles, "manage_messaging")) {
    redirect("/dashboard");
  }

  const settings = await getMessagingSettings();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Messaging</h1>
        <p className="text-xs text-muted-foreground">
          Connect Drivewell&apos;s WhatsApp number and email so the team can send
          customized bulk messages to clients.
        </p>
      </div>
      <MessagingSettingsForm initial={settings} />
    </div>
  );
}
