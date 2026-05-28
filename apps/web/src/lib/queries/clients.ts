import "server-only";

import { OrderStatus, PartAvailability, Prisma } from "@crm-tool/db";

import { prisma } from "@/lib/db";

/**
 * Server-side data fetchers for the CLIENT vertical (Modules B & C).
 *
 * These are plain async functions called from server components (the dashboard
 * overview, the client detail page) and from the list route handler that
 * TanStack Query hits on the client. They are READ-only — every authenticated
 * + approved user may view (SPEC §5 / PRD §9), so there is no RBAC gate here;
 * the dashboard layout already enforces authentication.
 */

/** Filters accepted by the dashboard / client list (CLT-09, DASH-05). */
export interface ClientListFilters {
  /** Free-text: matches client name, phone, email, whatsapp, or vehicle make/model/plate. */
  search?: string;
  /** Restrict to clients that have at least one order in this status. */
  status?: OrderStatus;
  /** Restrict to clients with an order assigned to this technician. */
  techId?: string;
  /** Quick filters from the dashboard. */
  quick?: "failed" | "due_today" | "parts_not_available";
  /** ISO date — orders received on/after this date. */
  receivedFrom?: string;
  /** ISO date — orders received on/before this date. */
  receivedTo?: string;
}

/** Start/end of "today" in WAT (UTC+1), returned as UTC Date objects. */
function watTodayRange(): { start: Date; end: Date } {
  const WAT_OFFSET_MS = 60 * 60 * 1000; // UTC+1, no DST in West Africa
  const nowWat = new Date(Date.now() + WAT_OFFSET_MS);
  const y = nowWat.getUTCFullYear();
  const m = nowWat.getUTCMonth();
  const d = nowWat.getUTCDate();
  const startUtc = new Date(Date.UTC(y, m, d) - WAT_OFFSET_MS);
  const endUtc = new Date(Date.UTC(y, m, d + 1) - WAT_OFFSET_MS);
  return { start: startUtc, end: endUtc };
}

/** Builds the Prisma `Order` where-clause shared by list filters. */
function buildOrderWhere(filters: ClientListFilters): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.techId) where.assignedTechId = filters.techId;

  if (filters.quick === "failed") {
    where.status = OrderStatus.FAILED;
  } else if (filters.quick === "due_today") {
    const { start, end } = watTodayRange();
    where.expectedDate = { gte: start, lt: end };
  } else if (filters.quick === "parts_not_available") {
    where.parts = { some: { availability: PartAvailability.NOT_AVAILABLE } };
  }

  if (filters.receivedFrom || filters.receivedTo) {
    where.receivedDate = {};
    if (filters.receivedFrom) where.receivedDate.gte = new Date(filters.receivedFrom);
    if (filters.receivedTo) where.receivedDate.lte = new Date(filters.receivedTo);
  }
  return where;
}

const clientListSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  status: true,
  updatedAt: true,
  vehicles: {
    select: { id: true, make: true, model: true, year: true },
    orderBy: { createdAt: "asc" },
  },
  orders: {
    select: {
      id: true,
      description: true,
      status: true,
      expectedDate: true,
      updatedAt: true,
      assignedTech: { select: { id: true, name: true } },
      vehicle: { select: { make: true, model: true, year: true } },
      parts: { select: { availability: true } },
    },
    orderBy: { updatedAt: "desc" },
  },
} satisfies Prisma.ClientSelect;

export type ClientListRow = Prisma.ClientGetPayload<{ select: typeof clientListSelect }>;

/**
 * DASH-01..03 / CLT-09: the dashboard client list with vehicle + order summary,
 * status, parts availability, expected completion, assigned tech, last update.
 *
 * Filters are applied at the order level for status/tech/quick filters, but a
 * client is included if ANY of its orders match (or, for a plain text search,
 * if the client or any vehicle matches). Clients with no orders still show.
 */
export async function getClientList(filters: ClientListFilters = {}): Promise<ClientListRow[]> {
  const orderWhere = buildOrderWhere(filters);
  const hasOrderFilter = Object.keys(orderWhere).length > 0;

  const where: Prisma.ClientWhereInput = {};

  if (filters.search) {
    const q = filters.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { whatsapp: { contains: q, mode: "insensitive" } },
      {
        vehicles: {
          some: {
            OR: [
              { make: { contains: q, mode: "insensitive" } },
              { model: { contains: q, mode: "insensitive" } },
              { plate: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      },
    ];
  }

  if (hasOrderFilter) {
    where.orders = { some: orderWhere };
  }

  return prisma.client.findMany({
    where,
    select: clientListSelect,
    orderBy: { updatedAt: "desc" },
  });
}

const clientDetailInclude = {
  vehicles: { orderBy: { createdAt: "asc" } },
  orders: {
    orderBy: { createdAt: "desc" },
    include: {
      parts: { orderBy: { createdAt: "asc" } },
      vehicle: true,
      assignedTech: { select: { id: true, name: true, email: true } },
    },
  },
  feedback: {
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { id: true, name: true } } },
  },
  communications: {
    orderBy: { createdAt: "desc" },
    include: { sender: { select: { id: true, name: true } } },
  },
  updates: {
    orderBy: { createdAt: "desc" },
    include: { author: { select: { id: true, name: true } } },
  },
} satisfies Prisma.ClientInclude;

export type ClientDetail = Prisma.ClientGetPayload<{ include: typeof clientDetailInclude }>;

/** CLT / DASH-04: full client detail — vehicles, orders, parts, feedback, comms. */
export async function getClientDetail(id: string): Promise<ClientDetail | null> {
  return prisma.client.findUnique({
    where: { id },
    include: clientDetailInclude,
  });
}

export interface ActivityLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  user: { id: string; name: string } | null;
}

/**
 * DASH-04: full status history for a client and its orders, drawn from the
 * shared ActivityLog (written by `withMutation`). Returns Client + Order
 * entries newest-first.
 */
export async function getClientActivity(
  clientId: string,
  orderIds: string[],
): Promise<ActivityLogEntry[]> {
  const logs = await prisma.activityLog.findMany({
    where: {
      OR: [
        { entityType: "Client", entityId: clientId },
        { entityType: "Order", entityId: { in: orderIds } },
        { entityType: "Part", entityId: { in: orderIds } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true } } },
    take: 200,
  });
  return logs.map((l) => ({
    id: l.id,
    entityType: l.entityType,
    entityId: l.entityId,
    action: l.action,
    metadata: l.metadata,
    createdAt: l.createdAt,
    user: l.user,
  }));
}

/** DASH-06 summary strip counts. */
export interface DashboardSummary {
  activeJobs: number;
  pending: number;
  inProgress: number;
  completedThisWeek: number;
  failed: number;
  awaitingParts: number;
}

/** Start of the current ISO week (Monday 00:00) in WAT, as a UTC Date. */
function watWeekStart(): Date {
  const WAT_OFFSET_MS = 60 * 60 * 1000;
  const nowWat = new Date(Date.now() + WAT_OFFSET_MS);
  const day = nowWat.getUTCDay(); // 0 = Sun
  const diffToMonday = (day + 6) % 7;
  const y = nowWat.getUTCFullYear();
  const m = nowWat.getUTCMonth();
  const d = nowWat.getUTCDate() - diffToMonday;
  return new Date(Date.UTC(y, m, d) - WAT_OFFSET_MS);
}

/** DASH-06: summary strip — active/pending/in-progress/completed-this-week/failed/awaiting-parts. */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const weekStart = watWeekStart();
  const [pending, inProgress, failed, onHold, completedThisWeek, awaitingParts] =
    await Promise.all([
      prisma.order.count({ where: { status: OrderStatus.PENDING } }),
      prisma.order.count({ where: { status: OrderStatus.IN_PROGRESS } }),
      prisma.order.count({ where: { status: OrderStatus.FAILED } }),
      prisma.order.count({ where: { status: OrderStatus.ON_HOLD } }),
      prisma.order.count({
        where: { status: OrderStatus.COMPLETED, updatedAt: { gte: weekStart } },
      }),
      prisma.order.count({
        where: { parts: { some: { availability: PartAvailability.NOT_AVAILABLE } } },
      }),
    ]);

  return {
    activeJobs: pending + inProgress + onHold,
    pending,
    inProgress,
    completedThisWeek,
    failed,
    awaitingParts,
  };
}

/** Feedback aggregate for a client (FB-03/04): avg, count, recent ratings. */
export interface FeedbackAggregate {
  count: number;
  average: number | null;
  /** Most recent ratings, newest-first, for a simple trend sparkline. */
  recent: { rating: number; createdAt: Date }[];
}

export async function getFeedbackAggregate(clientId: string): Promise<FeedbackAggregate> {
  const [agg, recent] = await Promise.all([
    prisma.feedback.aggregate({
      where: { clientId },
      _avg: { rating: true },
      _count: true,
    }),
    prisma.feedback.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { rating: true, createdAt: true },
    }),
  ]);
  return {
    count: agg._count,
    average: agg._avg.rating,
    recent,
  };
}

/** Technicians for the assigned-tech picker on the order form. */
export async function getTechnicians(): Promise<{ id: string; name: string }[]> {
  return prisma.user.findMany({
    where: { roles: { has: "TECHNICIAN" }, banned: { not: true } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
