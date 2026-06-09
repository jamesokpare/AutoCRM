"use client";

import { TaskPriority, TaskStatus } from "@crm-tool/db/enums";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@crm-tool/ui/components/select";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@crm-tool/ui/components/tabs";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { CompletionStat, type CompletionStatDTO } from "./completion-stat";
import { KanbanBoard } from "./kanban-board";
import { TaskCard } from "./task-card";
import { TaskForm } from "./task-form";
import type { PersonDTO, TaskDTO } from "./types";

const ALL = "__all__";

// value → label maps so the Select trigger shows the label, not the raw value.
const STATUS_ITEMS: Record<string, string> = {
  [ALL]: "All statuses",
  [TaskStatus.PENDING]: "Pending",
  [TaskStatus.IN_PROGRESS]: "In Progress",
  [TaskStatus.COMPLETED]: "Completed",
  [TaskStatus.FAILED]: "Failed",
};
const PRIORITY_ITEMS: Record<string, string> = {
  [ALL]: "All priorities",
  [TaskPriority.LOW]: "Low",
  [TaskPriority.MEDIUM]: "Medium",
  [TaskPriority.HIGH]: "High",
  [TaskPriority.URGENT]: "Urgent",
};

/**
 * ACC-02/03/04: the shared team board. Viewable by every authenticated user.
 * Two views (list + Kanban via tabs primitive), filterable by person / status /
 * priority, plus per-person weekly completion stats. Filters are applied
 * client-side over the week's tasks supplied by the server (carry-over already
 * folded in server-side).
 */
export function TeamBoard({
  tasks,
  stats,
  members,
  currentUserId,
  weekLabel,
}: {
  tasks: TaskDTO[];
  stats: CompletionStatDTO[];
  members: PersonDTO[];
  currentUserId: string;
  weekLabel: string;
}) {
  const router = useRouter();
  const [person, setPerson] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [priority, setPriority] = useState<string>(ALL);

  const filtered = useMemo(
    () =>
      tasks.filter((t) => {
        if (person !== ALL && t.assignee.id !== person) return false;
        if (status !== ALL && t.status !== status) return false;
        if (priority !== ALL && t.priority !== priority) return false;
        return true;
      }),
    [tasks, person, status, priority],
  );

  const personItems = useMemo<Record<string, string>>(
    () => ({
      [ALL]: "All people",
      ...Object.fromEntries(
        members.map((m) => [m.id, m.id === currentUserId ? `${m.name} (me)` : m.name]),
      ),
    }),
    [members, currentUserId],
  );

  const refresh = () => router.refresh();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Team board</h1>
          <p className="text-xs text-muted-foreground">{weekLabel}</p>
        </div>
        <TaskForm members={members} currentUserId={currentUserId} />
      </div>

      {/* ACC-04: per-person completion stats */}
      {stats.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <CompletionStat key={s.person.id} stat={s} />
          ))}
        </div>
      ) : null}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select items={personItems} value={person} onValueChange={(v) => setPerson(v as string)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Person" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All people</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.id === currentUserId ? `${m.name} (me)` : m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select items={STATUS_ITEMS} value={status} onValueChange={(v) => setStatus(v as string)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            <SelectItem value={TaskStatus.PENDING}>Pending</SelectItem>
            <SelectItem value={TaskStatus.IN_PROGRESS}>In Progress</SelectItem>
            <SelectItem value={TaskStatus.COMPLETED}>Completed</SelectItem>
            <SelectItem value={TaskStatus.FAILED}>Failed</SelectItem>
          </SelectContent>
        </Select>

        <Select items={PRIORITY_ITEMS} value={priority} onValueChange={(v) => setPriority(v as string)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All priorities</SelectItem>
            <SelectItem value={TaskPriority.LOW}>Low</SelectItem>
            <SelectItem value={TaskPriority.MEDIUM}>Medium</SelectItem>
            <SelectItem value={TaskPriority.HIGH}>High</SelectItem>
            <SelectItem value={TaskPriority.URGENT}>Urgent</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-xs text-muted-foreground">
          {filtered.length} task{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTab value="list">List</TabsTab>
          <TabsTab value="kanban">Kanban</TabsTab>
        </TabsList>

        <TabsPanel value="list" className="pt-3">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No tasks match these filters.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  showStatusBadge
                  currentUserId={currentUserId}
                  members={members}
                  onChanged={refresh}
                />
              ))}
            </div>
          )}
        </TabsPanel>

        <TabsPanel value="kanban" className="pt-3">
          <KanbanBoard
            tasks={filtered}
            currentUserId={currentUserId}
            members={members}
            onChanged={refresh}
          />
        </TabsPanel>
      </Tabs>
    </div>
  );
}
