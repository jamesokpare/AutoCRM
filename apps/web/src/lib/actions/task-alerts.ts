"use server";

import { auth } from "@crm-tool/auth";
import { NotificationType, TaskStatus } from "@crm-tool/db";
import { headers } from "next/headers";

import { prisma } from "@/lib/db";

/**
 * Lightweight feed powering the in-app "bimping" alert watcher: the most
 * recent TASK_ASSIGNED notifications for the caller plus the current count of
 * open (PENDING / IN_PROGRESS) tasks assigned to them. The watcher polls this
 * to play a chime when a fresh assignment lands and to nag throughout the day
 * while open tasks remain.
 */
export interface TaskAssignmentAlert {
  notificationId: string;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: string;
}

export interface TaskAlertFeed {
  /** Recent TASK_ASSIGNED notification rows (last ~24h, newest first). */
  recentAssignments: TaskAssignmentAlert[];
  /** Number of PENDING/IN_PROGRESS tasks currently assigned to the caller. */
  openTaskCount: number;
  /** Server clock so the client can resync drift if needed. */
  serverNow: string;
}

const EMPTY: TaskAlertFeed = {
  recentAssignments: [],
  openTaskCount: 0,
  serverNow: new Date(0).toISOString(),
};

export async function fetchTaskAlerts(): Promise<TaskAlertFeed> {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) return { ...EMPTY, serverNow: new Date().toISOString() };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [rows, openTaskCount] = await Promise.all([
    prisma.notification.findMany({
      where: {
        userId,
        type: NotificationType.TASK_ASSIGNED,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.task.count({
      where: {
        assigneeId: userId,
        status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
      },
    }),
  ]);

  return {
    recentAssignments: rows.map((n) => ({
      notificationId: n.id,
      title: n.title,
      body: n.body ?? null,
      link: n.link ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
    openTaskCount,
    serverNow: new Date().toISOString(),
  };
}
