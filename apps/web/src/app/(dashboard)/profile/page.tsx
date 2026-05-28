import { auth } from "@crm-tool/auth";
import { Role } from "@crm-tool/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@crm-tool/ui/components/card";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ProfileForm } from "@/components/team/profile-form";
import { ReviewAggregateCard } from "@/components/team/review-aggregate";
import { prisma } from "@/lib/db";
import { getRevieweeAggregate } from "@/lib/queries/reviews";

const VALID_ROLES = new Set<string>(Object.values(Role));

/**
 * EMP-01/02: the authenticated user's own editable profile (name, roles, photo,
 * KPIs, bottlenecks) + PERF-04 their performance aggregates/trend. As the
 * reviewee, the user always sees their own attributed individual reviews
 * (SPEC §9).
 */
export default async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      roles: true,
      jobTitle: true,
      photo: true,
      kpis: true,
      bottlenecks: true,
    },
  });
  if (!me) redirect("/login");

  const roles = (me.roles ?? []).filter((r): r is Role => VALID_ROLES.has(r));

  const aggregate = await getRevieweeAggregate({ id: me.id, roles }, me.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">My profile</h1>
        <p className="text-xs text-muted-foreground">
          Visible to the team. Edit your role(s), KPIs and bottlenecks.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Employee profile</CardTitle>
            <CardDescription>EMP-01/02</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm
              initial={{
                name: me.name,
                roles,
                jobTitle: me.jobTitle,
                photo: me.photo,
                kpis: me.kpis,
                bottlenecks: me.bottlenecks,
              }}
            />
          </CardContent>
        </Card>

        {aggregate ? (
          <ReviewAggregateCard aggregate={aggregate} title="My performance" />
        ) : null}
      </div>
    </div>
  );
}
