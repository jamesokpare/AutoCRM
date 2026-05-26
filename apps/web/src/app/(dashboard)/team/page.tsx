import { auth } from "@crm-tool/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { TeamBoard } from "@/components/team/team-board";
import type { TaskDTO } from "@/components/team/types";
import {
  computeCompletionStats,
  getTeamBoardTasks,
  listTeamMembers,
  type TaskRow,
} from "@/lib/queries/tasks";

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
  return `Week of ${fmt(start)} – ${fmt(last)} · incomplete prior tasks carried over`;
}

/**
 * ACC-02/03/04: shared team board (list + Kanban), viewable by ALL authenticated
 * users. Shows everyone's tasks for the current week (with carry-over folded in
 * by the query) plus per-person completion stats.
 */
export default async function TeamPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const [{ tasks, weekStart, weekEnd }, members] = await Promise.all([
    getTeamBoardTasks(),
    listTeamMembers(),
  ]);

  const stats = computeCompletionStats(tasks);

  return (
    <TeamBoard
      tasks={tasks.map(toDTO)}
      stats={stats}
      members={members}
      currentUserId={session.user.id}
      weekLabel={weekLabel(weekStart, weekEnd)}
    />
  );
}
