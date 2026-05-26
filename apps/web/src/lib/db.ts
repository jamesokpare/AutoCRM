/**
 * Shared Prisma client for the web app's server actions & route handlers.
 *
 * Import the singleton from here so every server action shares one connection
 * pool: `import { prisma } from "@/lib/db"`.
 */
import prisma from "@crm-tool/db";

export { prisma };
export default prisma;
