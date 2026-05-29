import path from "node:path";

import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

dotenv.config({
  path: "../../apps/web/.env",
});

export default defineConfig({
  schema: path.join("prisma", "schema"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    // Prefer the direct (unpooled) connection for schema operations — Neon's
    // pgbouncer pooled URL doesn't support the long-running session that
    // `prisma db push` / `migrate` needs.
    url: process.env.DATABASE_URL_DIRECT ? env("DATABASE_URL_DIRECT") : env("DATABASE_URL"),
  },
});
