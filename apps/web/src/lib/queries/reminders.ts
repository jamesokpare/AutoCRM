import { ReminderState, ReminderType } from "@crm-tool/db";

import { prisma } from "@/lib/db";
import { bucketByDueAt, type DueBucket } from "@/components/ops/wat";

/**
 * Reminders read model (REM-06 / REM-08).
 *
 * The centre partitions PENDING reminders into overdue / due-today / upcoming
 * by comparing `dueAt` (stored UTC) against "now" in WAT calendar days — see
 * `components/ops/wat.ts`. Computation happens ON LOAD; there is no scheduler.
 */

export interface ReminderView {
  id: string;
  type: ReminderType;
  state: ReminderState;
  dueAt: string; // ISO UTC
  recurrence: string | null;
  bucket: DueBucket;
  orderId: string | null;
  clientId: string | null;
  assigneeId: string | null;
  /** Human label for what the reminder is attached to. */
  subject: string;
  /** Assignee display name (or null when unassigned). */
  assigneeName: string | null;
}

export interface ReminderCentre {
  overdue: ReminderView[];
  today: ReminderView[];
  upcoming: ReminderView[];
}

type ReminderRow = {
  id: string;
  type: ReminderType;
  state: ReminderState;
  dueAt: Date;
  recurrence: string | null;
  orderId: string | null;
  clientId: string | null;
  assigneeId: string | null;
  order: { id: string; description: string; client: { name: string } } | null;
  client: { id: string; name: string } | null;
  assignee: { id: string; name: string } | null;
};

const include = {
  order: { select: { id: true, description: true, client: { select: { name: true } } } },
  client: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true } },
} as const;

function toView(r: ReminderRow, now: Date): ReminderView {
  let subject = "General reminder";
  if (r.order) {
    subject = `Order: ${r.order.description} (${r.order.client.name})`;
  } else if (r.client) {
    subject = `Client: ${r.client.name}`;
  }
  return {
    id: r.id,
    type: r.type,
    state: r.state,
    dueAt: r.dueAt.toISOString(),
    recurrence: r.recurrence,
    bucket: bucketByDueAt(r.dueAt, now),
    orderId: r.orderId,
    clientId: r.clientId,
    assigneeId: r.assigneeId,
    subject,
    assigneeName: r.assignee?.name ?? null,
  };
}

function partition(rows: ReminderRow[], now: Date): ReminderCentre {
  const centre: ReminderCentre = { overdue: [], today: [], upcoming: [] };
  for (const r of rows) {
    const view = toView(r, now);
    centre[view.bucket].push(view);
  }
  // Within each bucket, soonest-due first.
  const byDue = (a: ReminderView, b: ReminderView) =>
    new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  centre.overdue.sort(byDue);
  centre.today.sort(byDue);
  centre.upcoming.sort(byDue);
  return centre;
}

/**
 * REM-08 (per-user view): PENDING reminders assigned to `userId`, partitioned
 * into overdue / today / upcoming in WAT.
 */
export async function getMyReminderCentre(userId: string): Promise<ReminderCentre> {
  const now = new Date();
  const rows = (await prisma.reminder.findMany({
    where: { state: ReminderState.PENDING, assigneeId: userId },
    include,
    orderBy: { dueAt: "asc" },
  })) as ReminderRow[];
  return partition(rows, now);
}

/**
 * REM-08 (team-wide view): ALL PENDING reminders, partitioned in WAT. Visible
 * to every authenticated user per the headline VIEW rule (SPEC §5).
 */
export async function getTeamReminderCentre(): Promise<ReminderCentre> {
  const now = new Date();
  const rows = (await prisma.reminder.findMany({
    where: { state: ReminderState.PENDING },
    include,
    orderBy: { dueAt: "asc" },
  })) as ReminderRow[];
  return partition(rows, now);
}

/** Options for the reminder-create form: orders and clients to attach to. */
export interface ReminderTargets {
  orders: { id: string; label: string }[];
  clients: { id: string; label: string }[];
  users: { id: string; name: string }[];
}

export async function getReminderTargets(): Promise<ReminderTargets> {
  const [orders, clients, users] = await Promise.all([
    prisma.order.findMany({
      take: 200,
      orderBy: { createdAt: "desc" },
      select: { id: true, description: true, client: { select: { name: true } } },
    }),
    prisma.client.findMany({
      take: 200,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { banned: { not: true } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return {
    orders: orders.map((o) => ({ id: o.id, label: `${o.description} — ${o.client.name}` })),
    clients: clients.map((c) => ({ id: c.id, label: c.name })),
    users,
  };
}
