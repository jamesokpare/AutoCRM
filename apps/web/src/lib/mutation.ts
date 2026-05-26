import { prisma } from "@/lib/db";

/**
 * A domain event emitted after a successful mutation.
 *
 * In this phase `emitDomainEvent` is a no-op seam (SPEC §1 design rule). The
 * realtime + messaging phase will implement it as the publish call (Supabase
 * Realtime / Pusher / Ably) WITHOUT touching business logic.
 */
export interface DomainEvent {
  /** e.g. "Order", "Task", "Client" */
  entityType: string;
  entityId: string;
  /** e.g. "created", "updated", "status_changed" */
  action: string;
  /** the acting user id */
  userId: string;
  /** optional extra payload */
  metadata?: Record<string, unknown>;
}

/**
 * No-op realtime seam. DO NOT inline the publish here in this phase — the
 * realtime phase swaps the body of this function and everything else keeps
 * working.
 */
export async function emitDomainEvent(_event: DomainEvent): Promise<void> {
  // no-op (realtime phase will implement)
}

/** Context describing the mutation, used for the audit log + domain event. */
export interface MutationContext {
  /** Logical entity type, e.g. "Order". */
  entityType: string;
  /** The action verb, e.g. "created" / "updated" / "status_changed". */
  action: string;
  /** The acting user id (from the session). */
  userId: string;
  /**
   * Entity id. If you don't know it until the action runs (e.g. a create),
   * omit it and return `{ result, entityId }` from the action, or provide a
   * function that derives it from the action's result.
   */
  entityId?: string;
  /** Optional structured metadata stored on the ActivityLog row. */
  metadata?: Record<string, unknown>;
}

/**
 * Wraps a write action so every mutation, uniformly:
 *   1. runs the action,
 *   2. writes an `ActivityLog` row (entityType, entityId, action, userId, metadata),
 *   3. calls the `emitDomainEvent()` seam (no-op this phase).
 *
 * Usage (entityId known up front):
 * ```ts
 * await withMutation(
 *   { entityType: "Order", action: "status_changed", userId, entityId: order.id },
 *   async () => prisma.order.update(...),
 * );
 * ```
 *
 * Usage (entityId derived from result, e.g. create):
 * ```ts
 * const client = await withMutation(
 *   { entityType: "Client", action: "created", userId },
 *   async () => prisma.client.create(...),
 *   (created) => created.id, // resolveEntityId
 * );
 * ```
 *
 * The wrapper returns whatever the action returns. RBAC is NOT enforced here —
 * call `requirePermission` before invoking the action.
 */
export async function withMutation<T>(
  ctx: MutationContext,
  action: () => Promise<T>,
  resolveEntityId?: (result: T) => string,
): Promise<T> {
  const result = await action();

  const entityId = ctx.entityId ?? resolveEntityId?.(result);
  if (!entityId) {
    throw new Error(
      `withMutation: could not determine entityId for ${ctx.entityType}/${ctx.action}. ` +
        "Provide ctx.entityId or a resolveEntityId callback.",
    );
  }

  await prisma.activityLog.create({
    data: {
      entityType: ctx.entityType,
      entityId,
      action: ctx.action,
      userId: ctx.userId,
      metadata: (ctx.metadata ?? undefined) as never,
    },
  });

  await emitDomainEvent({
    entityType: ctx.entityType,
    entityId,
    action: ctx.action,
    userId: ctx.userId,
    metadata: ctx.metadata,
  });

  return result;
}
