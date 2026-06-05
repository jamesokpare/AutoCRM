"use client";

import type { Role } from "@crm-tool/db";
import { Button } from "@crm-tool/ui/components/button";
import { Separator } from "@crm-tool/ui/components/separator";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@crm-tool/ui/components/sheet";
import {
  Bell,
  BarChart3,
  Briefcase,
  ClipboardList,
  Clock,
  Gauge,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MessageSquare,
  Menu,
  Shield,
  Star,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Route } from "next";

import { authClient } from "@/lib/auth-client";
import { DrivewellLogo, DrivewellMark } from "@/components/logo";

interface NavItem {
  href: Route;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Only show to ADMIN. */
  adminOnly?: boolean;
  /** Which sidebar count drives the trailing badge (if any). */
  badge?: "notifications" | "tasks";
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Briefcase },
  { href: "/tasks", label: "Tasks", icon: ListChecks, badge: "tasks" },
  { href: "/team", label: "Team", icon: Users },
  { href: "/reviews", label: "Reviews", icon: ClipboardList },
  { href: "/kpi", label: "KPI Board", icon: Gauge },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/reminders", label: "Reminders", icon: Star },
  { href: "/attendance", label: "Attendance", icon: Clock },
  { href: "/notifications", label: "Notifications", icon: Bell, badge: "notifications" },
  { href: "/admin/users", label: "User Admin", icon: Shield, adminOnly: true },
  { href: "/admin/messaging", label: "Messaging", icon: MessageSquare, adminOnly: true },
  { href: "/profile", label: "Profile", icon: Users },
];

interface SidebarUser {
  name: string;
  email: string;
  roles: Role[];
}

export interface SidebarCounts {
  /** Unread Notification rows for the current user. */
  notifications: number;
  /** Open (PENDING / IN_PROGRESS) Task rows assigned to the current user. */
  tasks: number;
}

function NavBadge({ value }: { value: number }) {
  // Clamp very large counts to keep the badge inside the nav row.
  const label = value > 99 ? "99+" : String(value);
  return (
    <span
      aria-label={`${value} ${value === 1 ? "item" : "items"}`}
      className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-none text-primary-foreground tabular-nums"
    >
      {label}
    </span>
  );
}

function NavLinks({
  user,
  counts,
  onNavigate,
}: {
  user: SidebarUser;
  counts: SidebarCounts;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isAdmin = user.roles.includes("ADMIN" as Role);

  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.filter((item) => !item.adminOnly || isAdmin).map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const badgeValue = item.badge ? counts[item.badge] : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-2 rounded-none px-2.5 py-2 text-xs transition-colors ${
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
          >
            <Icon className="size-4" />
            {item.label}
            {item.badge && badgeValue > 0 ? <NavBadge value={badgeValue} /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarInner({
  user,
  counts,
  onNavigate,
}: {
  user: SidebarUser;
  counts: SidebarCounts;
  onNavigate?: () => void;
}) {
  const router = useRouter();

  return (
    <div className="flex h-full flex-col">
      <div className="px-2.5 py-3">
        <div className="flex items-center gap-2">
          <DrivewellLogo />
          <span className="text-sm font-semibold text-muted-foreground">CRM</span>
        </div>
        <div className="mt-1 truncate text-xs text-muted-foreground">{user.email}</div>
      </div>
      <Separator />
      <div className="flex-1 overflow-y-auto py-2">
        <NavLinks user={user} counts={counts} onNavigate={onNavigate} />
      </div>
      <Separator />
      <div className="p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() =>
            authClient.signOut({ fetchOptions: { onSuccess: () => router.push("/") } })
          }
        >
          <LogOut className="size-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}

export function DashboardSidebar({
  user,
  counts,
}: {
  user: SidebarUser;
  counts: SidebarCounts;
}) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden border-r bg-card lg:block">
        <SidebarInner user={user} counts={counts} />
      </aside>

      {/* Mobile top bar + sheet */}
      <div className="flex items-center justify-between border-b bg-card px-3 py-2 lg:hidden">
        <span className="flex items-center gap-2">
          <DrivewellMark className="size-6 shrink-0" />
          <span className="text-sm font-bold tracking-tight">Drivewell</span>
          <span className="text-sm font-semibold text-muted-foreground">CRM</span>
        </span>
        <Sheet>
          <SheetTrigger
            render={
              <Button variant="outline" size="icon-sm" aria-label="Open navigation">
                <Menu className="size-4" />
              </Button>
            }
          />
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarInner user={user} counts={counts} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
