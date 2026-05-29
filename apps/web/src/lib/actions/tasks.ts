"use server";

import { auth } from "@crm-tool/auth";
import { NotificationType, TaskPriority, TaskStatus } from "@crm-tool/db";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { withMutation } from "@/lib/mutation";
import { createNotification } from "@/lib/notifications";
import { PermissionError, requirePermission, type SessionLike } from "@/lib/rbac";
import type {
  CreateTaskInput,
  SetTaskStatusInput,
  TaskActionResult,
} from "./tasks-types";

const ALL_STATUSES = Object.values(TaskStatus) as TaskStatus[];
const ALL_PRIORITIES = Object.values(TaskPriority) as TaskPriority[];

interface SessionUserShape {
  id: string;
  roles?: string[] | null;
  isApproved?: boolean | null;
}

async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user as SessionUserShape | undefined;
}

function sessionLike(user: SessionUserShape): SessionLike {
  return { user: { roles: user.roles, isApproved: user.isApproved } };
}

function asResult(err: unknown): TaskActionResult {
  if (err instanceof PermissionError) return { ok: false, error: err.message };
  return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
}

function parseDate(value: string | null | undefined, fallback: Date | null): Date | null {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

/**
 * ACC-01: any user with `create_assign_tasks` (all roles) may create/assign a
 * task to anyone or to themselves. ACC-05: when the assignee differs from the
 * creator, a TASK_ASSIGNED notification record is created (pull-based).
 */
export async function createTask(input: CreateTaskInput): Promise<TaskActionResult> {
  const user = await getSessionUser();
  try {
    if (!user) throw new PermissionError("UNAUTHENTICATED", "You must be signed in.");
    requirePermission(sessionLike(user), "create_assign_tasks");

    const title = input.title?.trim();
    if (!title) return { ok: false, error: "Title is required." };

    const assigneeId = input.assigneeId?.trim() || user.id;
    const priority = ALL_PRIORITIES.includes(input.priority as TaskPriority)
      ? (input.priority as TaskPriority)
      : TaskPriority.MEDIUM;

    const date = parseDate(input.date, new Date())!;
    const dueDate = parseDate(input.dueDate, null);

    const task = await withMutation(
      {
        entityType: "Task",
        action: "created",
        userId: user.id,
        metadata: { assigneeId, priority },
      },
      async () =>
        prisma.task.create({
          data: {
            title,
            description: input.description?.trim() || null,
            date,
            dueDate,
            priority,
            status: TaskStatus.PENDING,
            assigneeId,
            createdById: user.id,
          },
        }),
      (created) => created.id,
    );

    // ACC-05: notify the assignee when assigned to someone else.
    if (assigneeId !== user.id) {
      await createNotification({
        userId: assigneeId,
        type: NotificationType.TASK_ASSIGNED,
        title: "New task assigned to you",
        body: title,
        link: "/tasks",
      });
    }

    revalidatePath("/team");
    revalidatePath("/tasks");
    return { ok: true, taskId: task.id };
  } catch (err) {
    return asResult(err);
  }
}

/**
 * Delete a task. Allowed for the creator or the assignee (the user wants to
 * delete "a task that you create or that you assign to someone").
 */
export async function deleteTask(taskId: string): Promise<TaskActionResult> {
  const user = await getSessionUser();
  try {
    if (!user) throw new PermissionError("UNAUTHENTICATED", "You must be signed in.");
    if (!taskId) return { ok: false, error: "Missing task." };

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, createdById: true, assigneeId: true, title: true },
    });
    if (!task) return { ok: false, error: "Task not found." };

    if (task.createdById !== user.id && task.assigneeId !== user.id) {
      return { ok: false, error: "Only the creator or assignee can delete this task." };
    }

    // Write the audit log first — Task has no FK from ActivityLog so this row
    // survives deletion.
    await prisma.activityLog.create({
      data: {
        entityType: "Task",
        entityId: taskId,
        action: "deleted",
        userId: user.id,
        metadata: { title: task.title },
      },
    });

    await prisma.task.delete({ where: { id: taskId } });

    revalidatePath("/team");
    revalidatePath("/tasks");
    return { ok: true, taskId };
  } catch (err) {
    return asResult(err);
  }
}

/**
 * ACC-02 (status updates on the board). Anyone with `create_assign_tasks` may
 * move a task through Pending → In Progress → Completed/Failed. Status is
 * preserved on carry-over (we never reset it).
 */
export async function setTaskStatus(input: SetTaskStatusInput): Promise<TaskActionResult> {
  const user = await getSessionUser();
  try {
    if (!user) throw new PermissionError("UNAUTHENTICATED", "You must be signed in.");
    requirePermission(sessionLike(user), "create_assign_tasks");

    if (!ALL_STATUSES.includes(input.status)) {
      return { ok: false, error: "Invalid status." };
    }
    if (!input.taskId) return { ok: false, error: "Missing task." };

    await withMutation(
      {
        entityType: "Task",
        action: "status_changed",
        userId: user.id,
        entityId: input.taskId,
        metadata: { status: input.status },
      },
      async () =>
        prisma.task.update({ where: { id: input.taskId }, data: { status: input.status } }),
    );

    revalidatePath("/team");
    revalidatePath("/tasks");
    return { ok: true, taskId: input.taskId };
  } catch (err) {
    return asResult(err);
  }
}
