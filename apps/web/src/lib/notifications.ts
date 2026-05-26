import { NotificationType } from "@crm-tool/db";

import { prisma } from "@/lib/db";

/** Input for {@link createNotification}. */
export interface CreateNotificationInput {
  /** Recipient user id. */
  userId: string;
  type: NotificationType;
  title: string;
  /** Optional longer body text. */
  body?: string;
  /** Optional in-app deep link, e.g. "/clients/abc". */
  link?: string;
}

/**
 * Inserts a `Notification` record (pull-based centre — SPEC "records only" phase).
 *
 * This only writes the row; instant push delivery is deferred to the realtime
 * phase. The notification-centre UI (another agent) reads these rows and
 * computes due-today / overdue / unread on load. Returns the created row.
 *
 * Example: low-rating feedback (FB-04) →
 * `createNotification({ userId: managerId, type: "LOW_RATING", title: "Low rating logged", link })`
 */
export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
    },
  });
}
