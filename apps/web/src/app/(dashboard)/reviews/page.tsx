import { auth } from "@crm-tool/auth";
import { Role } from "@crm-tool/db";
import { Badge } from "@crm-tool/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-tool/ui/components/card";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { PersonAvatar } from "@/components/team/person-avatar";
import { ReviewAggregateCard } from "@/components/team/review-aggregate";
import { ReviewForm } from "@/components/team/review-form";
import {
  currentCycle,
  getMyReviewFor,
  getRevieweeAggregate,
  listReviewableMembers,
} from "@/lib/queries/reviews";

const VALID_ROLES = new Set<string>(Object.values(Role));

/**
 * PERF-01..05: peer reviews. Everyone grades everyone for the current cycle.
 * Each member card shows their performance aggregate (PERF-04). Individual
 * attributed scores are surfaced only to Admin/Manager and the reviewee
 * (enforced in getRevieweeAggregate — SPEC §9).
 */
export default async function ReviewsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const viewerId = session.user.id;
  const roles = ((session.user as { roles?: string[] }).roles ?? []).filter(
    (r): r is Role => VALID_ROLES.has(r),
  );
  const viewer = { id: viewerId, roles };
  const cycle = currentCycle();

  const members = await listReviewableMembers(viewerId);

  const cards = await Promise.all(
    members.map(async (m) => {
      const [aggregate, existing] = await Promise.all([
        getRevieweeAggregate(viewer, m.id),
        getMyReviewFor(viewerId, m.id, cycle),
      ]);
      return { member: m, aggregate, existing };
    }),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Peer reviews</h1>
          <p className="text-xs text-muted-foreground">
            Grade your teammates on deliverables &amp; communication. Everyone grades everyone.
          </p>
        </div>
        <Badge variant="outline">Cycle {cycle}</Badge>
      </div>

      {cards.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">
          No other team members to review yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {cards.map(({ member, aggregate, existing }) => (
            <Card key={member.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <PersonAvatar person={member} />
                  {member.name}
                </CardTitle>
                <ReviewForm reviewee={member} cycle={cycle} existing={existing} />
              </CardHeader>
              <CardContent>
                {aggregate ? (
                  <ReviewAggregateCardInline aggregate={aggregate} />
                ) : (
                  <p className="text-xs text-muted-foreground">No data.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/** Reuses the aggregate card body without its own outer Card chrome. */
function ReviewAggregateCardInline({
  aggregate,
}: {
  aggregate: Parameters<typeof ReviewAggregateCard>[0]["aggregate"];
}) {
  return <ReviewAggregateCard aggregate={aggregate} title={aggregate.reviewee.name} />;
}
