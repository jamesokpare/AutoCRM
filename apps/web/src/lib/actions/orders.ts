"use server";

import { auth } from "@crm-tool/auth";
import { OrderStatus, PartAvailability, type Role } from "@crm-tool/db";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { withMutation } from "@/lib/mutation";
import { PermissionError, requireAuth, requirePermission } from "@/lib/rbac";
import type { ActionResult } from "./orders-types";

interface SessionUser {
  id: string;
  roles?: Role[] | null;
  isApproved?: boolean | null;
}

async function getSessionUser(): Promise<SessionUser | undefined> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user as SessionUser | undefined;
}

function fail(err: unknown): ActionResult<never> {
  if (err instanceof PermissionError) return { ok: false, error: err.message };
  if (err instanceof Error) return { ok: false, error: err.message };
  return { ok: false, error: "Something went wrong." };
}

function str(value: FormDataEntryValue | null): string | null {
  const v = (value as string | null)?.trim();
  return v ? v : null;
}

function parseDate(value: FormDataEntryValue | null): Date | null {
  const v = str(value);
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseStatus(value: FormDataEntryValue | null): OrderStatus | null {
  const v = str(value);
  if (!v) return null;
  return (Object.values(OrderStatus) as string[]).includes(v) ? (v as OrderStatus) : null;
}

function parseAvailability(value: FormDataEntryValue | null): PartAvailability | null {
  const v = str(value);
  if (!v) return null;
  return (Object.values(PartAvailability) as string[]).includes(v)
    ? (v as PartAvailability)
    : null;
}

const REQUIRES_REASON: OrderStatus[] = [OrderStatus.FAILED, OrderStatus.ON_HOLD];

/** Parts list arrives as repeated `partName` fields on the create/edit form. */
function parsePartNames(form: FormData): string[] {
  return form
    .getAll("partName")
    .map((p) => (p as string).trim())
    .filter(Boolean);
}

// ─────────────────────────────────────────────────────────────
// Order CRUD (CLT-03..06)
// ─────────────────────────────────────────────────────────────

export async function createOrder(
  clientId: string,
  form: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    requireAuth(user ? { user } : null);

    const vehicleId = str(form.get("vehicleId"));
    const description = str(form.get("description"));
    if (!vehicleId) return { ok: false, error: "Select a vehicle for this order." };
    if (!description) return { ok: false, error: "Description is required." };

    const status = parseStatus(form.get("status")) ?? OrderStatus.PENDING;
    const statusReason = str(form.get("statusReason"));
    if (REQUIRES_REASON.includes(status) && !statusReason) {
      return { ok: false, error: "A reason is required when status is Failed or On Hold." };
    }

    const receivedDate = parseDate(form.get("receivedDate")) ?? new Date();
    const expectedDate = parseDate(form.get("expectedDate"));
    const assignedTechName = str(form.get("assignedTechName"));
    const partNames = parsePartNames(form);

    const order = await withMutation(
      {
        entityType: "Order",
        action: "created",
        userId: user!.id,
        metadata: { clientId, vehicleId, status },
      },
      async () =>
        prisma.order.create({
          data: {
            clientId,
            vehicleId,
            description,
            status,
            statusReason: REQUIRES_REASON.includes(status) ? statusReason : null,
            receivedDate,
            expectedDate,
            assignedTechName,
            parts: partNames.length
              ? { create: partNames.map((name) => ({ name })) }
              : undefined,
          },
        }),
      (o) => o.id,
    );

    revalidatePath(`/clients/${clientId}`);
    revalidatePath("/dashboard");
    return { ok: true, data: { id: order.id } };
  } catch (err) {
    return fail(err);
  }
}

export async function updateOrder(
  orderId: string,
  form: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    requireAuth(user ? { user } : null);

    const description = str(form.get("description"));
    if (!description) return { ok: false, error: "Description is required." };
    const vehicleId = str(form.get("vehicleId"));

    const order = await withMutation(
      { entityType: "Order", action: "updated", userId: user!.id, entityId: orderId },
      async () =>
        prisma.order.update({
          where: { id: orderId },
          data: {
            description,
            vehicleId: vehicleId ?? undefined,
            expectedDate: parseDate(form.get("expectedDate")),
            receivedDate: parseDate(form.get("receivedDate")) ?? undefined,
            assignedTechName: str(form.get("assignedTechName")),
          },
        }),
    );

    revalidatePath(`/clients/${order.clientId}`);
    revalidatePath("/dashboard");
    return { ok: true, data: { id: order.id } };
  } catch (err) {
    return fail(err);
  }
}

/**
 * CLT-07: set order (job) status. Open to every authenticated team member —
 * any signed-in user may change a client's job status. A statusReason is
 * REQUIRED (rejected here) when the new status is FAILED or ON_HOLD.
 */
export async function setOrderStatus(
  orderId: string,
  status: OrderStatus,
  reason?: string,
): Promise<ActionResult> {
  try {
    const user = await getSessionUser();
    requireAuth(user ? { user } : null);

    if (!(Object.values(OrderStatus) as string[]).includes(status)) {
      return { ok: false, error: "Invalid status." };
    }

    const reasonClean = reason?.trim() || null;
    if (REQUIRES_REASON.includes(status) && !reasonClean) {
      return { ok: false, error: "A reason is required when marking an order Failed or On Hold." };
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, clientId: true, status: true },
    });
    if (!order) return { ok: false, error: "Order not found." };

    await withMutation(
      {
        entityType: "Order",
        action: "status_changed",
        userId: user!.id,
        entityId: orderId,
        metadata: { from: order.status, to: status, reason: reasonClean ?? undefined },
      },
      async () =>
        prisma.order.update({
          where: { id: orderId },
          data: {
            status,
            // Clear stale reason when moving away from FAILED/ON_HOLD.
            statusReason: REQUIRES_REASON.includes(status) ? reasonClean : null,
          },
        }),
    );

    revalidatePath(`/clients/${order.clientId}`);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// ─────────────────────────────────────────────────────────────
// Parts (CLT-08) — update_parts capability
// ─────────────────────────────────────────────────────────────

export async function addPart(
  orderId: string,
  name: string,
  availability?: PartAvailability,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    requirePermission(user ? { user } : null, "update_parts");

    const partName = name?.trim();
    if (!partName) return { ok: false, error: "Part name is required." };

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { clientId: true },
    });
    if (!order) return { ok: false, error: "Order not found." };

    const part = await withMutation(
      {
        entityType: "Part",
        action: "created",
        userId: user!.id,
        entityId: orderId,
        metadata: { orderId, name: partName },
      },
      async () =>
        prisma.part.create({
          data: {
            orderId,
            name: partName,
            availability: availability ?? PartAvailability.NOT_AVAILABLE,
          },
        }),
      (p) => p.id,
    );

    revalidatePath(`/clients/${order.clientId}`);
    revalidatePath("/dashboard");
    return { ok: true, data: { id: part.id } };
  } catch (err) {
    return fail(err);
  }
}

export async function setPartAvailability(
  partId: string,
  availability: PartAvailability,
): Promise<ActionResult> {
  try {
    const user = await getSessionUser();
    requirePermission(user ? { user } : null, "update_parts");

    const parsed = parseAvailability(availability);
    if (!parsed) return { ok: false, error: "Invalid availability." };

    const part = await prisma.part.findUnique({
      where: { id: partId },
      select: { orderId: true, order: { select: { clientId: true } } },
    });
    if (!part) return { ok: false, error: "Part not found." };

    await withMutation(
      {
        entityType: "Part",
        action: "availability_changed",
        userId: user!.id,
        entityId: part.orderId,
        metadata: { partId, availability: parsed },
      },
      async () => prisma.part.update({ where: { id: partId }, data: { availability: parsed } }),
    );

    revalidatePath(`/clients/${part.order.clientId}`);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}
