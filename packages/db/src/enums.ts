/**
 * Client-safe enum + type entry point.
 *
 * The package root (`@crm-tool/db`) eagerly instantiates a PrismaClient (which
 * pulls `node:module` and the Neon adapter), so importing an enum *value* from
 * it drags the server-only runtime into client bundles and breaks the build.
 *
 * This module re-exports ONLY Prisma's generated `enums.ts` — plain `as const`
 * objects with no runtime dependencies — so Client Components can import enum
 * values (e.g. `OrderStatus`, `ReminderType`) safely. Server code may keep
 * importing from `@crm-tool/db`.
 */
export * from "../prisma/generated/enums";
