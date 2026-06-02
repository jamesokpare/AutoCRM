/**
 * Shared types for client/vehicle server actions.
 *
 * These live OUTSIDE `clients.ts` because that file carries the `"use server"`
 * directive, and a server-action module may only export async functions.
 * Exporting types from it breaks the server-action boundary and pulls the
 * server-only Prisma client into client bundles.
 */

/** Uniform result shape for client-component form handlers. */
export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

/** A single client row parsed from a CSV/paste import (CLT bulk import). */
export interface ClientImportRow {
  name: string;
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  preferredChannel?: string | null;
  /** Combined "Make & Model" cell — split server-side when separate fields aren't present. */
  vehicleMakeModel?: string | null;
  make?: string | null;
  model?: string | null;
  year?: string | null;
  vin?: string | null;
  description?: string | null;
  orderStatus?: string | null;
  itemRequested?: string | null;
  externalOrderId?: string | null;
}

/** Outcome of a bulk client import. */
export interface ClientImportResult {
  created: number;
  skipped: number;
  vehiclesCreated: number;
  ordersCreated: number;
  /** Human-readable, row-scoped messages (capped) for skipped/failed rows. */
  errors: string[];
}
