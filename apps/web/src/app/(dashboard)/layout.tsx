import { auth } from "@crm-tool/auth";
import type { Role } from "@crm-tool/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { DashboardSidebar } from "@/components/dashboard-sidebar";

/**
 * Authenticated app shell. Owns the sidebar nav for ALL feature routes —
 * feature agents build pages, never touch navigation.
 *
 * Guards:
 *  - no session            → /login
 *  - session, !completed   → /onboarding (AUTH-02 forced first-login profile)
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login");
  }

  if (!session.user.profileCompleted) {
    redirect("/onboarding");
  }

  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-[220px_1fr]">
      <DashboardSidebar
        user={{
          name: session.user.name,
          email: session.user.email,
          roles: (session.user.roles ?? []) as Role[],
        }}
      />
      <main className="min-w-0 overflow-y-auto p-4 md:p-6">{children}</main>
    </div>
  );
}
