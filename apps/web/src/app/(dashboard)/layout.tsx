import { auth } from "@crm-tool/auth";
import { type Role, TaskStatus } from "@crm-tool/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { prisma } from "@/lib/db";

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

  // Sidebar badges: unread Notifications and open (PENDING / IN_PROGRESS)
  // Tasks assigned to the current user. Counted here so the sidebar stays a
  // dumb display component and the counts refresh on every navigation.
  const [notificationCount, taskCount] = await Promise.all([
    prisma.notification.count({
      where: { userId: session.user.id, read: false },
    }),
    prisma.task.count({
      where: {
        assigneeId: session.user.id,
        status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
      },
    }),
  ]);

  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-[220px_1fr]">
      <DashboardSidebar
        user={{
          name: session.user.name,
          email: session.user.email,
          roles: (session.user.roles ?? []) as Role[],
        }}
        counts={{ notifications: notificationCount, tasks: taskCount }}
      />
      <main className="min-w-0 overflow-y-auto p-4 md:p-6">{children}</main>
    </div>
  );
}
