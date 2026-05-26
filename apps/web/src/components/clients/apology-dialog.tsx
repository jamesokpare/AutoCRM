"use client";

import { Channel } from "@crm-tool/db/enums";
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

import { draftApology, updateApologyDraft } from "@/lib/actions/ai";
import type { ApologyTone } from "@/lib/actions/ai-types";

const TONES: ApologyTone[] = ["formal", "warm", "brief"];

/**
 * AI-01..05: draft an apology for an eligible order. Generates a DRAFT (never
 * sent), lets the user edit, and saves edits. The trigger is only rendered by
 * the caller when the order is eligible + the user has the capability.
 */
export function ApologyDialog({ orderId, trigger }: { orderId: string; trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const [tone, setTone] = useState<ApologyTone>("warm");
  const [channel, setChannel] = useState<Channel>(Channel.SMS);
  const [draft, setDraft] = useState("");
  const [commId, setCommId] = useState<string | null>(null);
  const [generating, startGenerate] = useTransition();
  const [saving, startSave] = useTransition();
  const router = useRouter();

  function onGenerate() {
    startGenerate(async () => {
      const res = await draftApology({ orderId, tone, channel, language: "English" });
      if (!res.ok || !res.data) {
        toast.error(res.error ?? "Failed to draft apology.");
        return;
      }
      setDraft(res.data.content);
      setCommId(res.data.communicationId);
      toast.success("Draft created (not sent)");
      router.refresh();
    });
  }

  function onSave() {
    if (!commId) return;
    startSave(async () => {
      const res = await updateApologyDraft(commId, draft);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to save draft.");
        return;
      }
      toast.success("Draft saved");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Draft apology</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          AI generates a draft only — nothing is sent. Review and edit before use.
        </p>

        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="tone">Tone</Label>
            <select
              id="tone"
              value={tone}
              onChange={(e) => setTone(e.target.value as ApologyTone)}
              className="h-8 rounded-none border border-input bg-transparent px-2.5 text-xs capitalize"
            >
              {TONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="channel">Channel</Label>
            <select
              id="channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value as Channel)}
              className="h-8 rounded-none border border-input bg-transparent px-2.5 text-xs"
            >
              {Object.values(Channel).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button type="button" size="sm" variant="outline" disabled={generating} onClick={onGenerate}>
              {generating ? "Generating…" : draft ? "Regenerate" : "Generate"}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="draft">Draft</Label>
          <Textarea
            id="draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={8}
            placeholder="Generate a draft, then edit here."
          />
        </div>

        <DialogFooter>
          <Button type="button" size="sm" disabled={!commId || saving} onClick={onSave}>
            {saving ? "Saving…" : "Save draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
