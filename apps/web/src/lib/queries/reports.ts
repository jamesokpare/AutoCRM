import "server-only";

import { prisma } from "@/lib/db";

/**
 * Monthly activity report (employee + client) broken down by week.
 *
 * Visible to every authenticated user. Aggregates entries from `ActivityLog`
 * (everything mutations go through `withMutation`) plus the modeled
 * client-facing rows (orders, feedback, communications, daily updates) so the
 * "client activity" tab reflects work happening against each client, not just
 * audit-trail rows.
 */

/** A calendar week within a given month: `[start, end)`. */
export interface WeekRange {
  /** 1-based index within the month (Week 1, Week 2, …). */
  index: number;
  start: Date;
  end: Date;
  label: string;
}

export interface EmployeeWeekStat {
  weekIndex: number;
  /** Total ActivityLog rows authored by the employee in this week. */
  total: number;
  /** Counts per entityType (Client, Order, Task, Part…). */
  byEntity: Record<string, number>;
}

export interface EmployeeMonthSummary {
  user: { id: string; name: string; email: string };
  weeks: EmployeeWeekStat[];
  /** Sum across the month. */
  total: number;
}

export interface ClientWeekStat {
  weekIndex: number;
  orders: number;
  feedback: number;
  communications: number;
  updates: number;
  total: number;
}

export interface ClientMonthSummary {
  client: { id: string; name: string; status: string };
  weeks: ClientWeekStat[];
  total: number;
}

export interface MonthlyReport {
  year: number;
  /** 1-based month (1 = January). */
  month: number;
  monthLabel: string;
  monthStart: Date;
  monthEnd: Date;
  weeks: WeekRange[];
  employees: EmployeeMonthSummary[];
  clients: ClientMonthSummary[];
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Computes calendar weeks (Mon-start) intersecting the given month. Each week
 * is clipped to the month bounds — Week 1 may start mid-week if the month
 * doesn't begin on a Monday, and the final week may end on the 1st of the
 * following month.
 */
function weeksForMonth(year: number, month: number): WeekRange[] {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));
  const weeks: WeekRange[] = [];

  let cursor = new Date(monthStart);
  let index = 1;
  while (cursor < monthEnd) {
    // First slice: from cursor to the next Monday (exclusive).
    const day = cursor.getUTCDay(); // 0 Sun..6 Sat
    const daysToNextMonday = ((1 - day + 7) % 7) || 7;
    const sliceEnd = new Date(cursor);
    sliceEnd.setUTCDate(sliceEnd.getUTCDate() + daysToNextMonday);
    const end = sliceEnd > monthEnd ? monthEnd : sliceEnd;

    const lastDay = new Date(end);
    lastDay.setUTCDate(lastDay.getUTCDate() - 1);
    const fmt = (d: Date) =>
      `${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()}`;
    weeks.push({
      index,
      start: new Date(cursor),
      end: new Date(end),
      label: `Week ${index} (${fmt(cursor)} – ${fmt(lastDay)})`,
    });
    cursor = end;
    index += 1;
  }
  return weeks;
}

/** Picks the week index a given date falls into, or `null` if outside the month. */
function weekIndexFor(date: Date, weeks: WeekRange[]): number | null {
  for (const w of weeks) {
    if (date >= w.start && date < w.end) return w.index;
  }
  return null;
}

/**
 * Build the full monthly report. All authenticated users may call this.
 *
 * `year` / `month` are 1-based (month 1 = January). UTC-based week boundaries
 * — straightforward, no DST surprises, good enough for a per-week summary.
 */
export async function getMonthlyReport(year: number, month: number): Promise<MonthlyReport> {
  const weeks = weeksForMonth(year, month);
  const monthStart = weeks[0]!.start;
  const monthEnd = weeks[weeks.length - 1]!.end;

  const [logs, users, orderRows, feedbackRows, commRows, updateRows, clients] =
    await Promise.all([
      prisma.activityLog.findMany({
        where: { createdAt: { gte: monthStart, lt: monthEnd } },
        select: {
          id: true,
          entityType: true,
          createdAt: true,
          userId: true,
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.user.findMany({ select: { id: true, name: true, email: true } }),
      prisma.order.findMany({
        where: { createdAt: { gte: monthStart, lt: monthEnd } },
        select: { id: true, clientId: true, createdAt: true },
      }),
      prisma.feedback.findMany({
        where: { createdAt: { gte: monthStart, lt: monthEnd } },
        select: { id: true, clientId: true, createdAt: true },
      }),
      prisma.communication.findMany({
        where: { createdAt: { gte: monthStart, lt: monthEnd } },
        select: { id: true, clientId: true, createdAt: true },
      }),
      prisma.clientUpdate.findMany({
        where: { createdAt: { gte: monthStart, lt: monthEnd } },
        select: { id: true, clientId: true, createdAt: true },
      }),
      prisma.client.findMany({
        select: { id: true, name: true, status: true },
        orderBy: { name: "asc" },
      }),
    ]);

  // Employee aggregation
  const empMap = new Map<string, EmployeeMonthSummary>();
  const emptyEmpWeeks = (): EmployeeWeekStat[] =>
    weeks.map((w) => ({ weekIndex: w.index, total: 0, byEntity: {} }));

  for (const u of users) {
    empMap.set(u.id, {
      user: { id: u.id, name: u.name, email: u.email },
      weeks: emptyEmpWeeks(),
      total: 0,
    });
  }

  for (const log of logs) {
    if (!log.user) continue;
    let entry = empMap.get(log.userId);
    if (!entry) {
      entry = {
        user: { id: log.user.id, name: log.user.name, email: log.user.email },
        weeks: emptyEmpWeeks(),
        total: 0,
      };
      empMap.set(log.userId, entry);
    }
    const idx = weekIndexFor(log.createdAt, weeks);
    if (idx === null) continue;
    const week = entry.weeks[idx - 1]!;
    week.total += 1;
    week.byEntity[log.entityType] = (week.byEntity[log.entityType] ?? 0) + 1;
    entry.total += 1;
  }

  const employees = Array.from(empMap.values())
    .filter((e) => e.total > 0 || users.some((u) => u.id === e.user.id))
    .sort((a, b) => b.total - a.total || a.user.name.localeCompare(b.user.name));

  // Client aggregation
  const clientMap = new Map<string, ClientMonthSummary>();
  const emptyClientWeeks = (): ClientWeekStat[] =>
    weeks.map((w) => ({
      weekIndex: w.index,
      orders: 0,
      feedback: 0,
      communications: 0,
      updates: 0,
      total: 0,
    }));

  for (const c of clients) {
    clientMap.set(c.id, {
      client: { id: c.id, name: c.name, status: c.status },
      weeks: emptyClientWeeks(),
      total: 0,
    });
  }

  function bump(
    clientId: string,
    createdAt: Date,
    field: "orders" | "feedback" | "communications" | "updates",
  ) {
    const entry = clientMap.get(clientId);
    if (!entry) return;
    const idx = weekIndexFor(createdAt, weeks);
    if (idx === null) return;
    const w = entry.weeks[idx - 1]!;
    w[field] += 1;
    w.total += 1;
    entry.total += 1;
  }

  for (const o of orderRows) bump(o.clientId, o.createdAt, "orders");
  for (const f of feedbackRows) bump(f.clientId, f.createdAt, "feedback");
  for (const c of commRows) bump(c.clientId, c.createdAt, "communications");
  for (const u of updateRows) bump(u.clientId, u.createdAt, "updates");

  const clientSummaries = Array.from(clientMap.values()).sort(
    (a, b) => b.total - a.total || a.client.name.localeCompare(b.client.name),
  );

  return {
    year,
    month,
    monthLabel: `${MONTH_NAMES[month - 1]} ${year}`,
    monthStart,
    monthEnd,
    weeks,
    employees,
    clients: clientSummaries,
  };
}

/** Serialise a report to CSV. One row per employee/client per week. */
export function reportToCSV(report: MonthlyReport): string {
  const rows: string[] = [];
  rows.push(`Monthly summary,${report.monthLabel}`);
  rows.push("");

  // Employees
  rows.push("EMPLOYEE ACTIVITY");
  const empHeader = ["Employee", "Email", ...report.weeks.map((w) => w.label), "Total"];
  rows.push(empHeader.map(csvCell).join(","));
  for (const emp of report.employees) {
    const cells = [
      emp.user.name,
      emp.user.email,
      ...emp.weeks.map((w) => String(w.total)),
      String(emp.total),
    ];
    rows.push(cells.map(csvCell).join(","));
  }

  rows.push("");
  rows.push("CLIENT ACTIVITY");
  const clientHeader = [
    "Client",
    "Status",
    ...report.weeks.map((w) => w.label),
    "Total",
  ];
  rows.push(clientHeader.map(csvCell).join(","));
  for (const c of report.clients) {
    const cells = [
      c.client.name,
      c.client.status,
      ...c.weeks.map((w) => String(w.total)),
      String(c.total),
    ];
    rows.push(cells.map(csvCell).join(","));
  }

  return rows.join("\n");
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Render a plain-text version of the report — used for the mailto body. */
export function reportToPlainText(report: MonthlyReport): string {
  const lines: string[] = [];
  lines.push(`Monthly summary — ${report.monthLabel}`);
  lines.push("");

  lines.push("Employee activity");
  lines.push("─".repeat(40));
  for (const emp of report.employees) {
    if (emp.total === 0) continue;
    lines.push(`${emp.user.name} (${emp.user.email}) — ${emp.total} actions`);
    for (const w of emp.weeks) {
      if (w.total === 0) continue;
      const parts = Object.entries(w.byEntity)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      lines.push(`  • Week ${w.weekIndex}: ${w.total}${parts ? ` (${parts})` : ""}`);
    }
  }
  lines.push("");

  lines.push("Client activity");
  lines.push("─".repeat(40));
  for (const c of report.clients) {
    if (c.total === 0) continue;
    lines.push(`${c.client.name} [${c.client.status}] — ${c.total} events`);
    for (const w of c.weeks) {
      if (w.total === 0) continue;
      lines.push(
        `  • Week ${w.weekIndex}: ${w.total} (orders ${w.orders}, feedback ${w.feedback}, comms ${w.communications}, updates ${w.updates})`,
      );
    }
  }

  return lines.join("\n");
}
