import { auth } from "@crm-tool/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { OnboardingForm } from "./onboarding-form";

/**
 * AUTH-02 forced first-login profile. Guards:
 *  - no session         → /login
 *  - already completed  → /dashboard
 */
export default async function OnboardingPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login");
  }
  if (session.user.profileCompleted) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10">
      <h1 className="text-xl font-semibold">Complete your profile</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Pick your role(s) and tell us your focus areas.
      </p>
      <div className="mt-6">
        <OnboardingForm />
      </div>
    </div>
  );
}
