import { auth } from "@crm-tool/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { MyWeek } from "@/components/team/my-week";
import type { TaskDTO } from "@/components/team/types";
import { getWeeklyTasks, listTeamMembers, type TaskRow } from "@/lib/queries/tasks";

function toDTO(t: TaskRow): TaskDTO {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    date: t.date.toISOString(),
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    status: t.status,
    priority: t.priority,
    assignee: t.assignee,
    createdBy: t.createdBy,
    overdue: t.overdue,
    carriedOver: t.carriedOver,
  };
}

function weekLabel(start: Date, end: Date): string {
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const last = new Date(end);
  last.setDate(last.getDate() - 1);
  return `Week of ${fmt(start)} – ${fmt(last)}`;
}

/**
 * EMP-03/05: the current user's weekly tasks, rolled up from daily entries with
 * unfinished prior-day/week tasks carried over (non-destructive — see
 * queries/tasks.ts getWeeklyTasks).
 */
export default async function TasksPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const [{ tasks, weekStart, weekEnd }, members] = await Promise.all([
    getWeeklyTasks({ assigneeId: session.user.id }),
    listTeamMembers(),
  ]);

  return (
    <MyWeek
      tasks={tasks.map(toDTO)}
      members={members}
      currentUserId={session.user.id}
      weekLabel={weekLabel(weekStart, weekEnd)}
    />
  );
}
