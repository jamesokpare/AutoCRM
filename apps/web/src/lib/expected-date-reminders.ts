import "server-only";

import { NotificationType, OrderStatus, Prisma } from "@crm-tool/db";

import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { watStartOfDay } from "@/components/ops/wat";

/**
 * "Expected completion date" reminder dispatch (run daily by the cron at
 * /api/cron/expected-date-reminders).
 *
 * Sends an in-app Notification to the user who entered an order's data
 * (resolved from the ActivityLog `created` entry) at 6, 4, 2 and 1 calendar
 * day(s) in WAT before the order's `expectedDate`. Idempotent via the
 * `OrderCompletionReminder` table — a row is written per (order, offset,
 * expectedDate, recipient) so a second run on the same day is a no-op, and
 * pushing the expectedDate out generates a fresh schedule of reminders.
 *
 * Skips orders whose status means there is nothing left to chase (COMPLETED,
 * FAILED, CUSTOMER_CANCELLED).
 */

/** Offsets (in WAT calendar days before expected completion) we fire on. */
export const REMINDER_OFFSETS_DAYS = [6, 4, 2, 1] as const;
export type ReminderOffset = (typeof REMINDER_OFFSETS_DAYS)[number];

/** Order statuses for which we no longer chase the expected date. */
const TERMINAL_STATUSES: OrderStatus[] = [
  OrderStatus.COMPLETED,
  OrderStatus.FAILED,
  OrderStatus.CUSTOMER_CANCELLED,
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface DispatchSummary {
  /** Orders whose expectedDate landed on one of the trigger days. */
  candidates: number;
  /** Notifications actually written (after dedupe). */
  sent: number;
  /** Skipped because already sent (idempotency hit). */
  alreadySent: number;
  /** Skipped because no creator could be resolved from the activity log. */
  noRecipient: number;
}

function offsetForExpectedDate(
  expectedDate: Date,
  now: Date,
): ReminderOffset | null {
  const todayStart = watStartOfDay(now).getTime();
  const expectedStart = watStartOfDay(expectedDate).getTime();
  const diffDays = Math.round((expectedStart - todayStart) / MS_PER_DAY);
  return (REMINDER_OFFSETS_DAYS as readonly number[]).includes(diffDays)
    ? (diffDays as ReminderOffset)
    : null;
}

function reminderTitle(offset: ReminderOffset): string {
  if (offset === 1) return "Order due tomorrow";
  return `Order due in ${offset} days`;
}

function reminderBody(
  offset: ReminderOffset,
  clientName: string,
  description: string,
  expectedDate: Date,
): string {
  const when = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(expectedDate);
  const lead =
    offset === 1
      ? "Tomorrow"
      : `In ${offset} days`;
  return `${lead} (${when}) — ${clientName}: ${description}`;
}

/**
 * Run the dispatch. Pass `now` to make tests deterministic. Returns a summary
 * the cron endpoint surfaces in its response body for observability.
 */
export async function dispatchExpectedDateReminders(
  now: Date = new Date(),
): Promise<DispatchSummary> {
  const summary: DispatchSummary = {
    candidates: 0,
    sent: 0,
    alreadySent: 0,
    noRecipient: 0,
  };

  // Window: orders whose expectedDate falls within the next 7 days in WAT.
  // We then filter to the exact offsets in JS so the WAT calendar bucketing is
  // unambiguous (a SQL date-trunc would have to know the timezone).
  const todayStart = watStartOfDay(now);
  const horizonEnd = new Date(todayStart.getTime() + 8 * MS_PER_DAY);

  const orders = await prisma.order.findMany({
    where: {
      expectedDate: { gte: todayStart, lt: horizonEnd },
      status: { notIn: TERMINAL_STATUSES },
    },
    select: {
      id: true,
      description: true,
      expectedDate: true,
      client: { select: { id: true, name: true } },
    },
  });

  if (orders.length === 0) return summary;

  // Resolve "the user who inputed the data" from the audit trail — the first
  // ActivityLog entry of action="created" for each order. No Order column
  // change needed; every create path already routes through `withMutation`.
  const orderIds = orders.map((o) => o.id);
  const creatorLogs = await prisma.activityLog.findMany({
    where: { entityType: "Order", action: "created", entityId: { in: orderIds } },
    orderBy: { createdAt: "asc" },
    select: { entityId: true, userId: true },
  });
  const creatorByOrderId = new Map<string, string>();
  for (const log of creatorLogs) {
    if (!creatorByOrderId.has(log.entityId)) {
      creatorByOrderId.set(log.entityId, log.userId);
    }
  }

  for (const order of orders) {
    if (!order.expectedDate) continue;
    const offset = offsetForExpectedDate(order.expectedDate, now);
    if (offset === null) continue;
    summary.candidates += 1;

    const userId = creatorByOrderId.get(order.id);
    if (!userId) {
      summary.noRecipient += 1;
      continue;
    }

    try {
      // Unique on (orderId, daysBefore, expectedDate, userId) makes this the
      // idempotency gate — a duplicate run hits the constraint and the catch
      // bumps `alreadySent` instead of sending again.
      await prisma.orderCompletionReminder.create({
        data: {
          orderId: order.id,
          daysBefore: offset,
          expectedDate: order.expectedDate,
          userId,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        summary.alreadySent += 1;
        continue;
      }
      throw err;
    }

    await createNotification({
      userId,
      type: NotificationType.REMINDER_DUE,
      title: reminderTitle(offset),
      body: reminderBody(offset, order.client.name, order.description, order.expectedDate),
      link: `/clients/${order.client.id}`,
    });
    summary.sent += 1;
  }

  return summary;
}
