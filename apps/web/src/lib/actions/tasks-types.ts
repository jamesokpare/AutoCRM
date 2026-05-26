import type { TaskPriority, TaskStatus } from "@crm-tool/db";

/**
 * Shared types for task server actions.
 *
 * These live OUTSIDE `tasks.ts` because that file carries the `"use server"`
 * directive, and a server-action module may only export async functions.
 * Exporting types from it breaks the server-action boundary and pulls the
 * server-only Prisma client into client bundles.
 */

export interface TaskActionResult {
  ok: boolean;
  error?: string;
  taskId?: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  /** Work day (ISO date string, e.g. "2026-05-25"). Defaults to today. */
  date?: string | null;
  /** Optional due date (ISO date string). */
  dueDate?: string | null;
  priority?: TaskPriority;
  /** Whom the task is for. Defaults to the creator (self-assign). */
  assigneeId?: string | null;
}

export interface SetTaskStatusInput {
  taskId: string;
  status: TaskStatus;
}
