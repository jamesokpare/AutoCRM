import { Badge } from "@crm-tool/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@crm-tool/ui/components/card";

import { PersonAvatar } from "./person-avatar";

/** Plain DTOs mirroring the reviews query aggregate (dates serialized away). */
export interface CriterionAvgDTO {
  key: string;
  label: string;
  average: number;
  count: number;
}
export interface TrendPointDTO {
  cycle: string;
  deliverables: number;
  communication: number;
  overall: number;
  count: number;
}
export interface IndividualReviewDTO {
  id: string;
  cycle: string;
  reviewer: { id: string; name: string; photo: string | null };
  deliverablesScore: number;
  communicationScore: number;
  comments: string | null;
  extraScores: Record<string, number> | null;
}
export interface ReviewAggregateDTO {
  reviewee: { id: string; name: string; photo: string | null };
  totalReviews: number;
  criteria: CriterionAvgDTO[];
  trend: TrendPointDTO[];
  individual: IndividualReviewDTO[] | null;
}

/**
 * PERF-04 + PERF-05 display. Always shows aggregates (per-criterion averages +
 * per-cycle trend). Individual attributed reviews are rendered ONLY when the
 * query layer supplied them (viewer is Admin/Manager or the reviewee) — for
 * everyone else `individual` is null and only aggregates appear (SPEC §9).
 */
export function ReviewAggregateCard({
  aggregate,
  title,
}: {
  aggregate: ReviewAggregateDTO;
  title?: string;
}) {
  const { reviewee, totalReviews, criteria, trend, individual } = aggregate;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PersonAvatar person={reviewee} />
          {title ?? reviewee.name}
        </CardTitle>
        <CardDescription>
          {totalReviews} review{totalReviews === 1 ? "" : "s"} · aggregates
          {individual ? " + individual scores" : " only"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-xs">
        {totalReviews === 0 ? (
          <p className="text-muted-foreground">No reviews yet.</p>
        ) : (
          <>
            {/* Per-criterion averages */}
            <div className="space-y-2">
              <p className="font-medium">Average scores</p>
              <div className="grid grid-cols-2 gap-2">
                {criteria.map((c) => (
                  <div
                    key={c.key}
                    className="flex items-center justify-between border border-border px-2 py-1.5"
                  >
                    <span className="truncate text-muted-foreground">{c.label}</span>
                    <span className="font-semibold tabular-nums">{c.average || "—"}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-cycle trend */}
            <div className="space-y-2">
              <p className="font-medium">Trend by cycle</p>
              <div className="space-y-1">
                {trend.map((p) => (
                  <div key={p.cycle} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 font-mono text-muted-foreground">{p.cycle}</span>
                    <div className="h-2 flex-1 overflow-hidden bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${(p.overall / 5) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right font-semibold tabular-nums">
                      {p.overall}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Individual attributed reviews (privileged viewers only) */}
            {individual ? (
              <div className="space-y-2">
                <p className="font-medium">Individual reviews</p>
                {individual.length === 0 ? (
                  <p className="text-muted-foreground">None.</p>
                ) : (
                  <div className="space-y-2">
                    {individual.map((r) => (
                      <div key={r.id} className="space-y-1 border border-border p-2">
                        <div className="flex items-center gap-2">
                          <PersonAvatar person={r.reviewer} className="size-5" />
                          <span className="font-medium">{r.reviewer.name}</span>
                          <Badge variant="outline">{r.cycle}</Badge>
                          <span className="ml-auto text-muted-foreground">
                            D{r.deliverablesScore} · C{r.communicationScore}
                          </span>
                        </div>
                        {r.extraScores
                          ? Object.entries(r.extraScores).map(([k, v]) => (
                              <span key={k} className="mr-2 text-muted-foreground">
                                {k}: {v}
                              </span>
                            ))
                          : null}
                        {r.comments ? <p className="text-muted-foreground">{r.comments}</p> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">
                Individual scores are visible to Admins, Managers and the reviewee only.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
