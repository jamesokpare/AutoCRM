import prisma from "@crm-tool/db";
import { env } from "@crm-tool/env/server";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";

export function createAuth() {
  // Reuse the shared singleton from @crm-tool/db rather than opening a second
  // Neon pool here (the app already routes all queries through that client).
  return betterAuth({
    database: prismaAdapter(prisma, {
      provider: "postgresql",
    }),

    trustedOrigins: [env.CORS_ORIGIN],
    emailAndPassword: {
      enabled: true,
    },
    // CRM profile fields (SPEC §3) — persisted on the Better-Auth `user` row
    // and returned on the session user object.
    user: {
      additionalFields: {
        roles: {
          type: "string[]",
          required: false,
          defaultValue: [],
          input: true,
        },
        kpis: {
          type: "string",
          required: false,
          input: true,
        },
        bottlenecks: {
          type: "string",
          required: false,
          input: true,
        },
        photo: {
          type: "string",
          required: false,
          input: true,
        },
        isApproved: {
          type: "boolean",
          required: false,
          defaultValue: false,
          // Approval is admin-controlled (AUTH-05) — clients must not set it.
          input: false,
        },
        profileCompleted: {
          type: "boolean",
          required: false,
          defaultValue: false,
          input: false,
        },
      },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    // admin plugin powers AUTH-04 user management (/admin/users).
    plugins: [admin(), nextCookies()],
  });
}

export const auth = createAuth();
