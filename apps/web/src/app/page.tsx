import { auth } from "@crm-tool/auth";
import { buttonVariants } from "@crm-tool/ui/components/button";
import { cn } from "@crm-tool/ui/lib/utils";
import {
  BarChart3,
  Bell,
  CalendarClock,
  Car,
  CheckCircle2,
  ClipboardList,
  MessageSquareHeart,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DrivewellLogo, DrivewellMark } from "@/components/logo";
import { ModeToggle } from "@/components/mode-toggle";

const FEATURES = [
  {
    icon: Car,
    title: "Clients & vehicles",
    description:
      "One record per customer with their full garage, order history, and parts — searchable and always up to date.",
  },
  {
    icon: ClipboardList,
    title: "Orders & tasks",
    description:
      "Track every job from intake to delivery. Assign work to the team and watch it move across the board.",
  },
  {
    icon: BarChart3,
    title: "KPIs that matter",
    description:
      "Company targets, employee performance, and bottlenecks surfaced on a single board — no spreadsheets.",
  },
  {
    icon: MessageSquareHeart,
    title: "Customer feedback",
    description:
      "Log and aggregate feedback in one place, then turn a tough review into a polished, AI-drafted apology.",
  },
  {
    icon: CalendarClock,
    title: "Reminders & follow-ups",
    description:
      "See what's due today, overdue, or coming up the moment you open the centre. Nothing slips through.",
  },
  {
    icon: Users,
    title: "Team & reviews",
    description:
      "Profiles, weekly tasks, and peer performance reviews keep the whole workshop accountable and aligned.",
  },
] as const;

const HIGHLIGHTS = [
  "Role-based access for every team member",
  "Full audit trail on every change",
  "AI-assisted customer apologies",
] as const;

export default async function Home() {
  // Authenticated users skip the marketing page and go straight to work.
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) {
    redirect(session.user.profileCompleted ? "/dashboard" : "/onboarding");
  }

  return (
    <div className="min-h-svh overflow-y-auto bg-background text-foreground">
      {/* Top navigation */}
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <DrivewellLogo />
          <div className="flex items-center gap-2">
            <ModeToggle />
            <Link
              href="/login?mode=signin"
              className={cn(
                buttonVariants({ variant: "ghost", size: "lg" }),
                "hidden sm:inline-flex",
              )}
            >
              Log in
            </Link>
            <Link href="/login" className={buttonVariants({ size: "lg" })}>
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(224,71,155,0.18),transparent_70%)]"
          />
          <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5 text-[#E0479B]" />
              The CRM built for automotive service teams
            </span>
            <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-6xl">
              Run your workshop on{" "}
              <span className="bg-gradient-to-r from-[#FF4D8D] via-[#E0479B] to-[#6C5CE7] bg-clip-text text-transparent">
                Drivewell CRM
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
              Clients, vehicles, orders, tasks, and team performance — all in one place. Spend less
              time chasing paperwork and more time keeping customers on the road.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/login"
                className={cn(buttonVariants({ size: "lg" }), "h-11 px-8 text-sm")}
              >
                Get started free
              </Link>
              <Link
                href="/login?mode=signin"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-11 px-8 text-sm",
                )}
              >
                Log in
              </Link>
            </div>
            <ul className="mx-auto mt-10 flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {HIGHLIGHTS.map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-[#6C5CE7]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Features */}
        <section className="border-t bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Everything your service team needs
              </h2>
              <p className="mt-4 text-muted-foreground">
                Purpose-built for automotive service shops — from the front desk to the workshop
                floor.
              </p>
            </div>
            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-xl border bg-card p-6 text-card-foreground transition-shadow hover:shadow-md"
                >
                  <div className="flex size-11 items-center justify-center rounded-lg bg-gradient-to-br from-[#FF4D8D]/15 to-[#6C5CE7]/15 text-[#E0479B]">
                    <feature.icon className="size-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust strip */}
        <section className="border-t">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-12 text-center sm:flex-row sm:justify-center sm:gap-8 sm:px-6">
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="size-4 text-[#6C5CE7]" /> Role-based security
            </span>
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Bell className="size-4 text-[#E0479B]" /> Smart reminders
            </span>
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="size-4 text-[#FF4D8D]" /> AI-assisted workflows
            </span>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="border-t bg-gradient-to-br from-[#FF4D8D] via-[#E0479B] to-[#6C5CE7]">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center text-white sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to drive your business forward?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-white/90">
              Create your account in seconds and bring your whole team onto Drivewell CRM today.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-11 bg-white px-8 text-sm text-[#6C5CE7] hover:bg-white/90",
                )}
              >
                Create your account
              </Link>
              <Link
                href="/login?mode=signin"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-11 border-white/60 bg-transparent px-8 text-sm text-white hover:bg-white/10 hover:text-white",
                )}
              >
                Log in
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <span className="flex items-center gap-2">
            <DrivewellMark className="size-5" />
            <span>© {new Date().getFullYear()} Drivewell CRM</span>
          </span>
          <div className="flex items-center gap-6">
            <Link href="/login?mode=signin" className="hover:text-foreground">
              Log in
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
