import { TaskStatus, type TaskPriority } from "@crm-tool/db";

import { prisma } from "@/lib/db";
import { watStartOfDay, watStartOfNextDay } from "@/components/ops/wat";

/**
 * Task vertical read models (EMP-03/05, ACC-02/03/04).
 *
 * All queries here are VIEW-only and unrestricted: per SPEC §5 / PRD §9 every
 * authenticated user can see the whole team's tasks. No capability gate.
 */

export interface TaskPerson {
  id: string;
  name: string;
  photo: string | null;
}

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  date: Date;
  dueDate: Date | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: TaskPerson;
  createdBy: TaskPerson;
  /** True when dueDate is in the past and the task is not COMPLETED (ACC-06). */
  overdue: boolean;
  /**
   * True when this task's work `date` is before the start of the viewed week
   * but it still shows up because it is unfinished (carry-over — EMP-05).
   */
  carriedOver: boolean;
}

const PERSON_SELECT = { id: true, name: true, photo: true } as const;

const TASK_SELECT = {
  id: true,
  title: true,
  description: true,
  date: true,
  dueDate: true,
  status: true,
  priority: true,
  assignee: { select: PERSON_SELECT },
  createdBy: { select: PERSON_SELECT },
} as const;

/** A task is "unfinished" while still PENDING or IN_PROGRESS. */
const UNFINISHED: TaskStatus[] = [TaskStatus.PENDING, TaskStatus.IN_PROGRESS];

/**
 * Monday 00:00 (local server time) for the week containing `ref`.
 * NOTE (SPEC §7): we store UTC and render WAT; week bucketing here uses the
 * server clock which is acceptable for this no-realtime phase.
 */
export function startOfWeek(ref: Date = new Date()): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  return d;
}

/** Exclusive end of the week (next Monday 00:00). */
export function endOfWeek(ref: Date = new Date()): Date {
  const start = startOfWeek(ref);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return end;
}

function decorate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any,
  weekStart: Date,
  now: Date,
): TaskRow {
  const overdue =
    !!t.dueDate && t.dueDate.getTime() < now.getTime() && t.status !== TaskStatus.COMPLETED;
  const carriedOver = t.date.getTime() < weekStart.getTime();
  return { ...t, overdue, carriedOver };
}

/**
 * EMP-05 carry-over (non-destructive, query-side):
 *
 * The weekly view = every task whose work `date` falls inside the week, PLUS
 * any task dated BEFORE the week that is still unfinished (PENDING/IN_PROGRESS).
 * We never mutate `date` to "move" a task forward — instead the carry-over is
 * recomputed every load by surfacing prior unfinished tasks into the current
 * week (flagged `carriedOver` so the UI can mark them). This keeps the original
 * work-day intact for history/audit while satisfying "incomplete tasks carry
 * over with status preserved".
 */
export async function getWeeklyTasks(opts: {
  /** Restrict to a single assignee (the /tasks "my week" view). */
  assigneeId?: string;
  /** Any date inside the week of interest (defaults to now). */
  ref?: Date;
}): Promise<{ weekStart: Date; weekEnd: Date; tasks: TaskRow[] }> {
  const now = new Date();
  const weekStart = startOfWeek(opts.ref ?? now);
  const weekEnd = endOfWeek(opts.ref ?? now);

  const assigneeFilter = opts.assigneeId ? { assigneeId: opts.assigneeId } : {};

  const tasks = await prisma.task.findMany({
    where: {
      ...assigneeFilter,
      OR: [
        // Tasks whose work day is in this week.
        { date: { gte: weekStart, lt: weekEnd } },
        // Carry-over: unfinished tasks dated before this week.
        { date: { lt: weekStart }, status: { in: UNFINISHED } },
      ],
    },
    orderBy: [{ date: "asc" }, { priority: "desc" }, { createdAt: "asc" }],
    select: TASK_SELECT,
  });

  return {
    weekStart,
    weekEnd,
    tasks: tasks.map((t) => decorate(t, weekStart, now)),
  };
}

/**
 * ACC-02/03: the full team board — everyone's tasks for the given week (with
 * carry-over), used by both list and Kanban views and by the per-person
 * completion stats.
 */
export async function getTeamBoardTasks(ref?: Date) {
  return getWeeklyTasks({ ref });
}

export interface CompletionStat {
  person: TaskPerson;
  total: number;
  completed: number;
  failed: number;
  /** % of this week's tasks completed (ACC-04). 0 when no tasks. */
  pct: number;
}

/**
 * ACC-04: per-person completion % for the supplied set of week tasks. Computed
 * in-memory from the already-fetched board so the board + stats stay consistent.
 */
export function computeCompletionStats(tasks: TaskRow[]): CompletionStat[] {
  const byPerson = new Map<string, { person: TaskPerson; total: number; completed: number; failed: number }>();
  for (const t of tasks) {
    const entry = byPerson.get(t.assignee.id) ?? {
      person: t.assignee,
      total: 0,
      completed: 0,
      failed: 0,
    };
    entry.total += 1;
    if (t.status === TaskStatus.COMPLETED) entry.completed += 1;
    if (t.status === TaskStatus.FAILED) entry.failed += 1;
    byPerson.set(t.assignee.id, entry);
  }
  return [...byPerson.values()]
    .map((e) => ({
      ...e,
      pct: e.total === 0 ? 0 : Math.round((e.completed / e.total) * 100),
    }))
    .sort((a, b) => a.person.name.localeCompare(b.person.name));
}

/**
 * Today's task summary (WAT calendar day) for a single user. Used by the
 * attendance flow to remind a user about what's on their plate when they
 * clock in, and to confirm completion when they clock out. Counts tasks whose
 * work `date` falls inside today's WAT day OR carry-over tasks dated before
 * today that are still unfinished — mirrors the weekly view's carry-over rule.
 */
export interface TodayTaskSummary {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
}

export async function getTodayTaskSummary(
  userId: string,
  now: Date = new Date(),
): Promise<TodayTaskSummary> {
  const todayStart = watStartOfDay(now);
  const todayEnd = watStartOfNextDay(now);

  const tasks = await prisma.task.findMany({
    where: {
      assigneeId: userId,
      OR: [
        { date: { gte: todayStart, lt: todayEnd } },
        { date: { lt: todayStart }, status: { in: UNFINISHED } },
      ],
    },
    select: { status: true },
  });

  const summary: TodayTaskSummary = {
    total: tasks.length,
    pending: 0,
    inProgress: 0,
    completed: 0,
    failed: 0,
  };
  for (const t of tasks) {
    if (t.status === TaskStatus.PENDING) summary.pending += 1;
    else if (t.status === TaskStatus.IN_PROGRESS) summary.inProgress += 1;
    else if (t.status === TaskStatus.COMPLETED) summary.completed += 1;
    else if (t.status === TaskStatus.FAILED) summary.failed += 1;
  }
  return summary;
}

/** People list for assignment selectors and board grouping. */
export async function listTeamMembers(): Promise<TaskPerson[]> {
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: PERSON_SELECT,
  });
  return users;
}
