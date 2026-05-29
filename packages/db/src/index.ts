import { env } from "@crm-tool/env/server";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

import { PrismaClient } from "../prisma/generated/client";

// The Neon serverless driver talks to Postgres over a WebSocket. In Node-based
// runtimes (Vercel serverless functions, local `next dev`) there is no reliable
// global WebSocket, so per Neon's official Prisma setup we hand it the `ws`
// implementation. Without this, the build and any cookie-less request succeed,
// but the first real query (e.g. a sign-up DB write) can't open its socket and
// the route 500s — which looks like "login just fails".
if (!neonConfig.webSocketConstructor) {
  neonConfig.webSocketConstructor = ws;
}

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
