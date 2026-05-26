"use server";

import { auth } from "@crm-tool/auth";
import { Channel, type Role } from "@crm-tool/db";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { withMutation } from "@/lib/mutation";
import {
  type ClientListFilters,
  type ClientListRow,
  getClientList,
} from "@/lib/queries/clients";
import { PermissionError, requirePermission } from "@/lib/rbac";
import type { ActionResult } from "./clients-types";

/** Shape of the Better-Auth session user we read for RBAC. */
interface SessionUser {
  id: string;
  roles?: Role[] | null;
  isApproved?: boolean | null;
}

/** Loads the session, asserting `edit_clients_orders`. Returns the user. */
async function requireEdit(): Promise<SessionUser> {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user as SessionUser | undefined;
  requirePermission(user ? { user } : null, "edit_clients_orders");
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
