"use server";

import { auth } from "@crm-tool/auth";
import {
  Channel,
  ClientStatus,
  OrderStatus,
  PartAvailability,
  type Role,
  ServiceStatus,
} from "@crm-tool/db";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { withMutation } from "@/lib/mutation";
import {
  type ClientListFilters,
  type ClientListRow,
  getClientList,
} from "@/lib/queries/clients";
import { PermissionError, requireAuth } from "@/lib/rbac";
import type {
  ActionResult,
  ClientImportResult,
  ClientImportRow,
} from "./clients-types";

/** Shape of the Better-Auth session user we read. */
interface SessionUser {
  id: string;
  roles?: Role[] | null;
  isApproved?: boolean | null;
}

/**
 * Loads the session, asserting only that the user is signed in. Editing client
 * details is intentionally open to every authenticated team member (no role
 * gate). Returns the user.
 */
async function requireEdit(): Promise<SessionUser> {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user as SessionUser | undefined;
  requireAuth(user ? { user } : null);
  return user!;
}

function fail(err: unknown): ActionResult<never> {
  if (err instanceof PermissionError) return { ok: false, error: err.message };
  if (err instanceof Error) return { ok: false, error: err.message };
  return { ok: false, error: "Something went wrong." };
}

/**
 * Read-only list fetcher exposed as a server action so client components can
 * call it from a TanStack Query `queryFn` (DASH-01, refetch-on-focus). All
 * authenticated + approved viewers may read; the dashboard layout already
 * enforces authentication, so no capability check here.
 */
export async function listClientsAction(filters: ClientListFilters): Promise<ClientListRow[]> {
  return getClientList(filters);
}

function parseChannel(value: FormDataEntryValue | null): Channel | null {
  const v = (value as string | null)?.trim();
  if (!v) return null;
  return (Object.values(Channel) as string[]).includes(v) ? (v as Channel) : null;
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

function parseClientStatus(value: string | null | undefined): ClientStatus | null {
  if (!value) return null;
  return (Object.values(ClientStatus) as string[]).includes(value)
    ? (value as ClientStatus)
    : null;
}

function parseAvailability(value: string): PartAvailability {
  return (Object.values(PartAvailability) as string[]).includes(value)
    ? (value as PartAvailability)
    : PartAvailability.NOT_AVAILABLE;
}

const REQUIRES_REASON: OrderStatus[] = [OrderStatus.FAILED, OrderStatus.ON_HOLD];

// "Due today" and "Parts not available" are derived dashboard buckets, not
// stored statuses. The intake form offers them in the status dropdown; here we
// map them onto the underlying order fields (expected date / a NOT_AVAILABLE
// part) so the new order lands in that dashboard filter. Kept in sync with the
// sentinels in components/clients/order-actions.tsx.
const DUE_TODAY_STATUS = "__due_today__";
const PARTS_NA_STATUS = "__parts_not_available__";

/**
 * Reads the parts list from the intake form. Parts arrive as index-aligned
 * repeated `partName` / `partAvailability` fields; an empty name is skipped.
 */
function parsePartsPairs(form: FormData): { name: string; availability: PartAvailability }[] {
  const names = form.getAll("partName").map((p) => (p as string).trim());
  const avails = form.getAll("partAvailability").map((a) => a as string);
  const parts: { name: string; availability: PartAvailability }[] = [];
  names.forEach((name, i) => {
    if (name) parts.push({ name, availability: parseAvailability(avails[i] ?? "") });
  });
  return parts;
}

// ─────────────────────────────────────────────────────────────
// Client CRUD (CLT-01)
// ─────────────────────────────────────────────────────────────

export async function createClient(form: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireEdit();
    const name = str(form.get("name"));
    if (!name) return { ok: false, error: "Client name is required." };

    const client = await withMutation(
      { entityType: "Client", action: "created", userId: user.id, metadata: { name } },
      async () =>
        prisma.client.create({
          data: {
            name,
            phone: str(form.get("phone")),
            email: str(form.get("email")),
            whatsapp: str(form.get("whatsapp")),
            address: str(form.get("address")),
            preferredChannel: parseChannel(form.get("preferredChannel")),
          },
        }),
      (c) => c.id,
    );

    revalidatePath("/clients");
    revalidatePath("/dashboard");
    return { ok: true, data: { id: client.id } };
  } catch (err) {
    return fail(err);
  }
}

/** Trim a free-text import cell to a non-empty string, else null. */
function cleanCell(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

/** Parse a channel name from an import cell (case-insensitive), else null. */
function channelFromCell(value: string | null | undefined): Channel | null {
  const v = value?.trim().toUpperCase();
  if (!v) return null;
  return (Object.values(Channel) as string[]).includes(v) ? (v as Channel) : null;
}

/** Hard cap so a single import can't run away with the request. */
const MAX_IMPORT_ROWS = 1000;

/**
 * CLT bulk import: create many clients from rows parsed (client-side) out of a
 * CSV file or pasted text. Rows missing a name are skipped and reported; the
 * rest are created one-by-one so a single bad row can't abort the batch. Open
 * to every signed-in team member, like the other client writes. Each created
 * client is logged via `withMutation` (source: "import").
 */
export async function importClients(
  rows: ClientImportRow[],
): Promise<ActionResult<ClientImportResult>> {
  try {
    const user = await requireEdit();

    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: false, error: "No rows to import." };
    }
    if (rows.length > MAX_IMPORT_ROWS) {
      return { ok: false, error: `Too many rows — max ${MAX_IMPORT_ROWS} per import.` };
    }

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = cleanCell(row?.name);
      if (!name) {
        skipped++;
        if (errors.length < 50) errors.push(`Row ${i + 1}: missing name — skipped.`);
        continue;
      }
      try {
        await withMutation(
          {
            entityType: "Client",
            action: "created",
            userId: user.id,
            metadata: { name, source: "import" },
          },
          async () =>
            prisma.client.create({
              data: {
                name,
                phone: cleanCell(row.phone),
                email: cleanCell(row.email),
                whatsapp: cleanCell(row.whatsapp),
                address: cleanCell(row.address),
                preferredChannel: channelFromCell(row.preferredChannel),
              },
            }),
          (c) => c.id,
        );
        created++;
      } catch {
        skipped++;
        if (errors.length < 50) errors.push(`Row ${i + 1} (${name}): failed to create.`);
      }
    }

    revalidatePath("/clients");
    revalidatePath("/dashboard");
    return { ok: true, data: { created, skipped, errors } };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Full client intake: creates a client plus, optionally, a first vehicle and a
 * first order (with status, parts + availability, expected date and assigned
 * technician) in one submission. Open to every signed-in team member.
 *
 * The vehicle is created only when make/model/year are provided; the order is
 * created only when a description is provided AND a vehicle was created (an
 * order requires a vehicle). Each entity is logged via `withMutation`.
 */
export async function createClientFull(form: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireEdit();
    const name = str(form.get("name"));
    if (!name) return { ok: false, error: "Client name is required." };

    // Vehicle is optional; present when make+model+year are all filled in.
    const make = str(form.get("make"));
    const model = str(form.get("model"));
    const year = parseYear(form.get("year"));
    const hasVehicle = Boolean(make && model && year !== null);

    // Order is optional; requires a description and a vehicle to attach to.
    const description = str(form.get("description"));
    const wantsOrder = Boolean(description);
    if (wantsOrder && !hasVehicle) {
      return { ok: false, error: "Add a vehicle before creating an order." };
    }

    // The status field may carry a real OrderStatus or one of the two derived
    // sentinels, which resolve to PENDING plus a side effect (see below).
    const rawStatus = str(form.get("status"));
    const dueToday = rawStatus === DUE_TODAY_STATUS;
    const partsNotAvailable = rawStatus === PARTS_NA_STATUS;
    const status =
      dueToday || partsNotAvailable
        ? OrderStatus.PENDING
        : (parseStatus(form.get("status")) ?? OrderStatus.PENDING);
    const statusReason = str(form.get("statusReason"));
    if (wantsOrder && REQUIRES_REASON.includes(status) && !statusReason) {
      return { ok: false, error: "A reason is required when status is Failed or On Hold." };
    }

    const client = await withMutation(
      { entityType: "Client", action: "created", userId: user.id, metadata: { name } },
      async () =>
        prisma.client.create({
          data: {
            name,
            phone: str(form.get("phone")),
            email: str(form.get("email")),
            whatsapp: str(form.get("whatsapp")),
            address: str(form.get("address")),
            preferredChannel: parseChannel(form.get("preferredChannel")),
          },
        }),
      (c) => c.id,
    );

    if (hasVehicle) {
      const vehicle = await withMutation(
        {
          entityType: "Vehicle",
          action: "created",
          userId: user.id,
          metadata: { clientId: client.id, make, model, year },
        },
        async () =>
          prisma.vehicle.create({
            data: {
              clientId: client.id,
              make: make!,
              model: model!,
              year: year!,
              plate: str(form.get("plate")),
              vin: str(form.get("vin")),
              color: str(form.get("color")),
              mileage: parseYear(form.get("mileage")),
            },
          }),
        (v) => v.id,
      );

      if (wantsOrder) {
        const parts = parsePartsPairs(form);
        // "Parts not available" guarantees at least one unavailable part so the
        // order matches the dashboard's parts filter.
        if (partsNotAvailable && !parts.some((p) => p.availability === PartAvailability.NOT_AVAILABLE)) {
          parts.push({ name: "Awaiting part", availability: PartAvailability.NOT_AVAILABLE });
        }
        await withMutation(
          {
            entityType: "Order",
            action: "created",
            userId: user.id,
            metadata: { clientId: client.id, vehicleId: vehicle.id, status },
          },
          async () =>
            prisma.order.create({
              data: {
                clientId: client.id,
                vehicleId: vehicle.id,
                description: description!,
                status,
                statusReason: REQUIRES_REASON.includes(status) ? statusReason : null,
                receivedDate: parseDate(form.get("receivedDate")) ?? new Date(),
                expectedDate: dueToday ? new Date() : parseDate(form.get("expectedDate")),
                assignedTechName: str(form.get("assignedTechName")),
                itemRequested: str(form.get("itemRequested")),
                externalOrderId: str(form.get("externalOrderId")),
                parts: parts.length ? { create: parts } : undefined,
              },
            }),
          (o) => o.id,
        );
      }
    }

    revalidatePath("/clients");
    revalidatePath("/dashboard");
    return { ok: true, data: { id: client.id } };
  } catch (err) {
    return fail(err);
  }
}

/** Change a client's relationship status (PROSPECT/ACTIVE/INACTIVE/ARCHIVED). */
export async function setClientStatus(
  clientId: string,
  status: ClientStatus,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireEdit();
    const parsed = parseClientStatus(status);
    if (!parsed) return { ok: false, error: "Invalid client status." };

    const current = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, status: true },
    });
    if (!current) return { ok: false, error: "Client not found." };

    await withMutation(
      {
        entityType: "Client",
        action: "status_changed",
        userId: user.id,
        entityId: clientId,
        metadata: { from: current.status, to: parsed },
      },
      async () => prisma.client.update({ where: { id: clientId }, data: { status: parsed } }),
    );

    revalidatePath(`/clients/${clientId}`);
    revalidatePath("/clients");
    revalidatePath("/dashboard");
    return { ok: true, data: { id: clientId } };
  } catch (err) {
    return fail(err);
  }
}

function parseServiceStatus(value: string | null | undefined): ServiceStatus | null {
  if (!value) return null;
  return (Object.values(ServiceStatus) as string[]).includes(value)
    ? (value as ServiceStatus)
    : null;
}

/**
 * Set (or clear, with null) a client's manual service status — the seven-value
 * status surfaced in the dashboard filters (CLT). Lets a client be filtered by
 * status even before it has any order. Open to every signed-in team member.
 */
export async function setClientServiceStatus(
  clientId: string,
  status: ServiceStatus | null,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireEdit();
    const parsed = status === null ? null : parseServiceStatus(status);
    if (status !== null && !parsed) return { ok: false, error: "Invalid service status." };

    const current = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, serviceStatus: true },
    });
    if (!current) return { ok: false, error: "Client not found." };

    await withMutation(
      {
        entityType: "Client",
        action: "service_status_changed",
        userId: user.id,
        entityId: clientId,
        metadata: { from: current.serviceStatus, to: parsed },
      },
      async () => prisma.client.update({ where: { id: clientId }, data: { serviceStatus: parsed } }),
    );

    revalidatePath(`/clients/${clientId}`);
    revalidatePath("/clients");
    revalidatePath("/dashboard");
    return { ok: true, data: { id: clientId } };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Delete a client and all dependent rows (vehicles, orders, parts, feedback,
 * communications, reminders, daily updates — cascaded by the schema). The
 * audit log entry is written before deletion so the trail survives.
 */
export async function deleteClient(clientId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireEdit();
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true },
    });
    if (!client) return { ok: false, error: "Client not found." };

    // Log the deletion first — the cascade removes the client row, but the
    // ActivityLog entry persists (no FK to Client).
    await prisma.activityLog.create({
      data: {
        entityType: "Client",
        entityId: clientId,
        action: "deleted",
        userId: user.id,
        metadata: { name: client.name },
      },
    });

    await prisma.client.delete({ where: { id: clientId } });

    revalidatePath("/clients");
    revalidatePath("/dashboard");
    return { ok: true, data: { id: clientId } };
  } catch (err) {
    return fail(err);
  }
}

export async function updateClient(
  clientId: string,
  form: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireEdit();
    const name = str(form.get("name"));
    if (!name) return { ok: false, error: "Client name is required." };

    await withMutation(
      { entityType: "Client", action: "updated", userId: user.id, entityId: clientId },
      async () =>
        prisma.client.update({
          where: { id: clientId },
          data: {
            name,
            phone: str(form.get("phone")),
            email: str(form.get("email")),
            whatsapp: str(form.get("whatsapp")),
            address: str(form.get("address")),
            preferredChannel: parseChannel(form.get("preferredChannel")),
          },
        }),
    );

    revalidatePath(`/clients/${clientId}`);
    revalidatePath("/clients");
    revalidatePath("/dashboard");
    return { ok: true, data: { id: clientId } };
  } catch (err) {
    return fail(err);
  }
}

// ─────────────────────────────────────────────────────────────
// Vehicle CRUD (CLT-02)
// ─────────────────────────────────────────────────────────────

function parseYear(value: FormDataEntryValue | null): number | null {
  const v = str(value);
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export async function addVehicle(
  clientId: string,
  form: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireEdit();
    const make = str(form.get("make"));
    const model = str(form.get("model"));
    const year = parseYear(form.get("year"));
    if (!make || !model || year === null) {
      return { ok: false, error: "Make, model and year are required." };
    }
    const mileage = parseYear(form.get("mileage"));

    const vehicle = await withMutation(
      {
        entityType: "Vehicle",
        action: "created",
        userId: user.id,
        metadata: { clientId, make, model, year },
      },
      async () =>
        prisma.vehicle.create({
          data: {
            clientId,
            make,
            model,
            year,
            plate: str(form.get("plate")),
            vin: str(form.get("vin")),
            color: str(form.get("color")),
            mileage,
          },
        }),
      (v) => v.id,
    );

    revalidatePath(`/clients/${clientId}`);
    return { ok: true, data: { id: vehicle.id } };
  } catch (err) {
    return fail(err);
  }
}

export async function updateVehicle(
  vehicleId: string,
  form: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireEdit();
    const make = str(form.get("make"));
    const model = str(form.get("model"));
    const year = parseYear(form.get("year"));
    if (!make || !model || year === null) {
      return { ok: false, error: "Make, model and year are required." };
    }

    const vehicle = await withMutation(
      { entityType: "Vehicle", action: "updated", userId: user.id, entityId: vehicleId },
      async () =>
        prisma.vehicle.update({
          where: { id: vehicleId },
          data: {
            make,
            model,
            year,
            plate: str(form.get("plate")),
            vin: str(form.get("vin")),
            color: str(form.get("color")),
            mileage: parseYear(form.get("mileage")),
          },
        }),
    );

    revalidatePath(`/clients/${vehicle.clientId}`);
    return { ok: true, data: { id: vehicle.id } };
  } catch (err) {
    return fail(err);
  }
}
