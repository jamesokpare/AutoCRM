"use client";

import { Button } from "@crm-tool/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@crm-tool/ui/components/dialog";
import { Input } from "@crm-tool/ui/components/input";
import { Label } from "@crm-tool/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@crm-tool/ui/components/select";
import { Textarea } from "@crm-tool/ui/components/textarea";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { submitReview } from "@/lib/actions/reviews";

import type { PersonDTO } from "./types";

const SCORES = [1, 2, 3, 4, 5];

interface ExtraCriterion {
  key: string;
  score: number;
}

function ScoreSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="w-24">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SCORES.map((s) => (
          <SelectItem key={s} value={String(s)}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * PERF-01/02/03: grade a peer. deliverables + communication (1–5), optional
 * comments and configurable extra criteria (stored as JSON). Submitting again
 * for the same cycle edits the existing review (upsert in the action).
 */
export function ReviewForm({
  reviewee,
  cycle,
  existing,
}: {
  reviewee: PersonDTO;
  cycle: string;
  existing?: {
    deliverablesScore: number;
    communicationScore: number;
    comments: string | null;
    extraScores: Record<string, number> | null;
  } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [deliverables, setDeliverables] = useState(existing?.deliverablesScore ?? 3);
  const [communication, setCommunication] = useState(existing?.communicationScore ?? 3);
  const [comments, setComments] = useState(existing?.comments ?? "");
  const [extras, setExtras] = useState<ExtraCriterion[]>(
    existing?.extraScores
      ? Object.entries(existing.extraScores).map(([key, score]) => ({ key, score }))
      : [],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant={existing ? "outline" : "default"}>
            {existing ? "Edit review" : "Review"}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Review {reviewee.name} · {cycle}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <Label>Deliverables (1–5)</Label>
            <ScoreSelect value={deliverables} onChange={setDeliverables} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label>Communication (1–5)</Label>
            <ScoreSelect value={communication} onChange={setCommunication} />
          </div>

          {extras.map((ex, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                placeholder="Criterion name"
                value={ex.key}
                onChange={(e) =>
                  setExtras((prev) =>
                    prev.map((p, i) => (i === idx ? { ...p, key: e.target.value } : p)),
                  )
                }
              />
              <ScoreSelect
                value={ex.score}
                onChange={(v) =>
                  setExtras((prev) => prev.map((p, i) => (i === idx ? { ...p, score: v } : p)))
                }
              />
              <Button
                size="xs"
                variant="ghost"
                type="button"
                onClick={() => setExtras((prev) => prev.filter((_, i) => i !== idx))}
              >
                Remove
              </Button>
            </div>
          ))}

          <Button
            size="xs"
            variant="outline"
            type="button"
            className="w-fit"
            onClick={() => setExtras((prev) => [...prev, { key: "", score: 3 }])}
          >
            + Add criterion
          </Button>

          <div className="space-y-1.5">
            <Label htmlFor="review-comments">Comments (optional)</Label>
            <Textarea
              id="review-comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const extraScores: Record<string, number> = {};
                for (const ex of extras) {
                  if (ex.key.trim()) extraScores[ex.key.trim()] = ex.score;
                }
                const res = await submitReview({
                  revieweeId: reviewee.id,
                  cycle,
                  deliverablesScore: deliverables,
                  communicationScore: communication,
                  comments,
                  extraScores: Object.keys(extraScores).length ? extraScores : null,
                });
                if (!res.ok) {
                  toast.error(res.error ?? "Failed to submit review");
                  return;
                }
                toast.success("Review saved");
                setOpen(false);
                router.refresh();
              })
            }
          >
            {pending ? "Saving…" : "Submit review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
