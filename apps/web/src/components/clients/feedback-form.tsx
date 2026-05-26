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
import { Label } from "@crm-tool/ui/components/label";
import { Textarea } from "@crm-tool/ui/components/textarea";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { logFeedback } from "@/lib/actions/feedback";

export interface OrderChoice {
  id: string;
  label: string;
}

/** FB-01: log a 1–5 rating + comments against a client, optionally an order. */
export function FeedbackForm({
  clientId,
  orders,
  trigger,
}: {
  clientId: string;
  orders: OrderChoice[];
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comments, setComments] = useState("");
  const [orderId, setOrderId] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const res = await logFeedback(clientId, {
        rating,
        comments: comments || undefined,
        orderId: orderId || undefined,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Failed to log feedback.");
        return;
      }
      toast.success("Feedback logged");
      setOpen(false);
      setComments("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log feedback</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label>Rating</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <Button
                  key={n}
                  type="button"
                  size="icon-sm"
                  variant={n <= rating ? "default" : "outline"}
                  onClick={() => setRating(n)}
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>

          {orders.length > 0 ? (
            <div className="flex flex-col gap-1">
              <Label htmlFor="orderId">Related order (optional)</Label>
              <select
                id="orderId"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                className="h-8 rounded-none border border-input bg-transparent px-2.5 text-xs"
              >
                <option value="">General feedback</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="flex flex-col gap-1">
            <Label htmlFor="comments">Comments</Label>
            <Textarea
              id="comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
