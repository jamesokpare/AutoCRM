import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import type { auth } from "@crm-tool/auth";

export const authClient = createAuthClient({
  plugins: [
    // Mirrors the server `admin()` plugin (AUTH-04) and infers the CRM
    // profile fields added via user.additionalFields (roles, kpis, etc.).
    adminClient(),
    inferAdditionalFields<typeof auth>(),
  ],
});
