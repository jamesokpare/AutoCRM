"use client";

import { TaskStatus } from "@crm-tool/db/enums";
import { Badge } from "@crm-tool/ui/components/badge";

import { TaskCard } from "./task-card";
import type { PersonDTO, TaskDTO } from "./types";

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: TaskStatus.PENDING, label: "Pending" },
  { status: TaskStatus.IN_PROGRESS, label: "In Progress" },
  { status: TaskStatus.COMPLETED, label: "Completed" },
  { status: TaskStatus.FAILED, label: "Failed" },
];

/**
 * ACC-02/03 Kanban view: Pending → In Progress → Completed / Failed. Status
 * changes happen via each card's status select (no DnD this phase).
 */
export function KanbanBoard({
  tasks,
  currentUserId,
  members,
  onChanged,
}: {
  tasks: TaskDTO[];
  currentUserId?: string;
  members?: PersonDTO[];
  onChanged?: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.status);
        return (
          <div key={col.status} className="flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {col.label}
              </span>
              <Badge variant="outline">{colTasks.length}</Badge>
            </div>
            <div className="flex flex-col gap-2">
              {colTasks.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No tasks</p>
              ) : (
                colTasks.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    currentUserId={currentUserId}
                    members={members}
                    onChanged={onChanged}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
