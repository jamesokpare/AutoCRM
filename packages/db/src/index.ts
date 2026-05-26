import { env } from "@crm-tool/env/server";
import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "../prisma/generated/client";

export function createPrismaClient() {
  const adapter = new PrismaNeon({
    connectionString: env.DATABASE_URL,
  });

  return new PrismaClient({ adapter });
}

// Reuse a single client across module reloads. Without this, Next dev's HMR
// re-evaluates this module on every edit, each time opening a new Neon pool and
// leaking the old one — connections accumulate until requests start to 500.
const globalForPrisma = globalThis as unknown as {
  __crmPrisma?: ReturnType<typeof createPrismaClient>;
};

const prisma = globalForPrisma.__crmPrisma ?? createPrismaClient();
if (env.NODE_ENV !== "production") {
  globalForPrisma.__crmPrisma = prisma;
}

export default prisma;

// Re-export the generated Prisma client surface (model types, enums, Prisma
// namespace) so the rest of the monorepo imports everything from `@crm-tool/db`.
export * from "../prisma/generated/client";
