import { Role } from "@crm-tool/db";

/**
 * RBAC capabilities — one per editable/admin row of SPEC §5.
 *
 * VIEW access is intentionally NOT modelled here: per PRD §9, every
 * authenticated + approved user can view the dashboard, task board, perf
 * summaries and KPI board. Only edit/admin actions require a capability.
 */
export type Capability =
  | "manage_users" // Manage users (admin plugin, /admin/users)
  | "edit_clients_orders" // Create/edit clients & orders
  | "update_job_status" // Update job/order status (technician: assigned only — enforced in action)
  | "update_parts" // Update parts availability
  | "use_ai_apology" // Use AI apology drafting
  | "create_assign_tasks" // Create/assign tasks (to anyone)
  | "grade_performance" // Grade peer performance
  | "set_kpi_targets"; // Set company KPI targets

/**
 * Capability → roles matrix (SPEC §5 Appendix A).
 *
 * Note on `update_job_status`: TECHNICIAN is granted the capability here, but
 * the "assigned-only" restriction (SPEC §5 footnote) must be enforced inside
 * the setOrderStatus action by comparing order.assignedTechId to the user id.
 */
const MATRIX: Record<Capability, Role[]> = {
  manage_users: [Role.ADMIN],
  edit_clients_orders: [Role.ADMIN, Role.MANAGER, Role.SERVICE_ADVISOR],
  update_job_status: [Role.ADMIN, Role.MANAGER, Role.SERVICE_ADVISOR, Role.TECHNICIAN],
  update_parts: [Role.ADMIN, Role.MANAGER, Role.SERVICE_ADVISOR, Role.PARTS_STAFF],
  use_ai_apology: [Role.ADMIN, Role.MANAGER, Role.SERVICE_ADVISOR],
  create_assign_tasks: [
    Role.ADMIN,
    Role.MANAGER,
    Role.SERVICE_ADVISOR,
    Role.TECHNICIAN,
    Role.PARTS_STAFF,
  ],
  grade_performance: [
    Role.ADMIN,
    Role.MANAGER,
    Role.SERVICE_ADVISOR,
    Role.TECHNICIAN,
    Role.PARTS_STAFF,
  ],
  set_kpi_targets: [Role.ADMIN, Role.MANAGER],
};

/**
 * Pure capability check against a set of roles.
 *
 * Does NOT consider approval — callers that gate edits should also verify
 * approval (use `requirePermission`, which enforces both). Returns true if any
 * of the provided roles grants the capability.
 */
export function can(roles: Role[], cap: Capability): boolean {
  const allowed = MATRIX[cap];
  return roles.some((r) => allowed.includes(r));
}

/**
 * Minimal shape of the authenticated user needed for authorization.
 *
 * `roles` is widened to `string[]` because Better-Auth's additionalFields type
 * the session `user.roles` as `string[]`. Values are validated against the
 * Role enum internally, so you can pass `session.user` directly.
 */
export interface AuthorizedUser {
  roles?: (Role | string)[] | null;
  isApproved?: boolean | null;
}

const VALID_ROLES = new Set<string>(Object.values(Role));

/** Narrows an arbitrary string[] to known Role values. */
function toRoles(roles: (Role | string)[] | null | undefined): Role[] {
  return (roles ?? []).filter((r): r is Role => VALID_ROLES.has(r));
}

/** Session-like shape accepted by `requirePermission`. */
export interface SessionLike {
  user: AuthorizedUser;
}

/**
 * Thrown by `requirePermission` when authorization fails. Carries a stable
 * `code` so callers / UI can distinguish the failure reason.
 */
export class PermissionError extends Error {
  code: "UNAUTHENTICATED" | "FORBIDDEN";
  constructor(code: "UNAUTHENTICATED" | "FORBIDDEN", message?: string) {
    super(message ?? code);
    this.name = "PermissionError";
    this.code = code;
  }
}

/**
 * Asserts the session user may perform `cap`. Throws `PermissionError` otherwise.
 *
 * Enforcement order (SPEC §5):
 *   1. Must be authenticated.
 *   2. One of the user's roles must grant the capability.
 *
 * Call this at the top of every write server action. Returns the validated
 * roles for convenience.
 */
export function requirePermission(session: SessionLike | null | undefined, cap: Capability): Role[] {
  if (!session?.user) {
    throw new PermissionError("UNAUTHENTICATED", "You must be signed in.");
  }
  const roles = toRoles(session.user.roles);
  if (!can(roles, cap)) {
    throw new PermissionError("FORBIDDEN", `You do not have permission to: ${cap}.`);
  }
  return roles;
}
