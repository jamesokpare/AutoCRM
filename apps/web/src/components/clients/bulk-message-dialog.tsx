"use client";

import { Channel, ClientStatus } from "@crm-tool/db/enums";
import { Badge } from "@crm-tool/ui/components/badge";
import { Button } from "@crm-tool/ui/components/button";
import { Checkbox } from "@crm-tool/ui/components/checkbox";
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
import { Tabs, TabsList, TabsPanel, TabsTab } from "@crm-tool/ui/components/tabs";
import { Textarea } from "@crm-tool/ui/components/textarea";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { listBulkClientOptions, sendBulkMessages } from "@/lib/actions/messaging";
import type {
  BulkClientOption,
  BulkSendResult,
} from "@/lib/actions/messaging-types";

import { ClientStatusBadge } from "./status-badge";

const CHANNEL_OPTIONS = [
  { value: Channel.WHATSAPP, label: "WhatsApp" },
  { value: Channel.EMAIL, label: "Email" },
];

const STATUS_FILTER_OPTIONS: { value: ClientStatus; label: string }[] = [
  { value: ClientStatus.PROSPECT, label: "Prospect" },
  { value: ClientStatus.ACTIVE, label: "Active" },
  { value: ClientStatus.INACTIVE, label: "Inactive" },
  { value: ClientStatus.ARCHIVED, label: "Archived" },
];

const SAMPLE_TEMPLATES = {
  WHATSAPP: `Hi {{firstName}}, this is Drivewell. A quick update on your {{vehicle}}: we'll have it ready as planned. Let us know if you have any questions.`,
  EMAIL: `Hi {{firstName}},

Thanks for trusting Drivewell with your {{vehicle}}. We wanted to let you know about our latest service offers.

— The Drivewell team`,
};

export function BulkMessageDialog({
  trigger,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  initialClientIds,
  onSent,
}: {
  trigger?: React.ReactElement;
  /** Controlled-open prop. Omit to let the dialog manage its own open state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** When provided, the dialog opens with audience = "selected" and these IDs ticked. */
  initialClientIds?: string[];
  /** Called once after a successful send (useful for clearing parent selection). */
  onSent?: () => void;
}) {
  const isControlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? openProp : internalOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChangeProp?.(next);
  };

  const [tab, setTab] = useState<"recipients" | "compose">("recipients");
  const [channel, setChannel] = useState<Channel>(Channel.WHATSAPP);
  const [audience, setAudience] = useState<"all" | "selected">(
    initialClientIds && initialClientIds.length > 0 ? "selected" : "all",
  );
  const [clients, setClients] = useState<BulkClientOption[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initialClientIds ?? []),
  );
  const [statusFilter, setStatusFilter] = useState<Set<ClientStatus>>(new Set());
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState(SAMPLE_TEMPLATES.WHATSAPP);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<BulkSendResult | null>(null);

  // Re-seed the selection / audience whenever the parent's initialClientIds
  // change between opens (e.g. the user picks a different row set in the table).
  useEffect(() => {
    if (!open) return;
    if (initialClientIds && initialClientIds.length > 0) {
      setSelectedIds(new Set(initialClientIds));
      setAudience("selected");
    }
    // Intentionally not depending on initialClientIds identity — we only want
    // to reseed when the dialog (re)opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || clients) return;
    let cancelled = false;
    listBulkClientOptions().then((rows) => {
      if (!cancelled) setClients(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [open, clients]);

  useEffect(() => {
    // Swap the sample when the channel changes only if the user hasn't edited it
    // off the default for the other channel.
    if (
      content === SAMPLE_TEMPLATES.WHATSAPP ||
      content === SAMPLE_TEMPLATES.EMAIL
    ) {
      setContent(channel === Channel.EMAIL ? SAMPLE_TEMPLATES.EMAIL : SAMPLE_TEMPLATES.WHATSAPP);
    }
  }, [channel, content]);

  // Apply the status filter first — it constrains BOTH the "All" audience and
  // the recipient picker, so an unticked client cannot leak in via the audience
  // switch.
  const statusFiltered = useMemo(() => {
    if (!clients) return [] as BulkClientOption[];
    if (statusFilter.size === 0) return clients;
    return clients.filter((c) => statusFilter.has(c.status));
  }, [clients, statusFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return statusFiltered;
    return statusFiltered.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q) ||
        (c.whatsapp ?? "").includes(q),
    );
  }, [statusFiltered, search]);

  // Universe = the pool of clients the send will hit AFTER status filtering.
  const universe = useMemo(() => {
    if (audience === "all") return statusFiltered;
    return statusFiltered.filter((c) => selectedIds.has(c.id));
  }, [statusFiltered, audience, selectedIds]);

  const reachable = useMemo(
    () =>
      universe.filter((c) =>
        channel === Channel.WHATSAPP ? Boolean(c.whatsapp || c.phone) : Boolean(c.email),
      ).length,
    [universe, channel],
  );

  const totalSelected = universe.length;

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleStatus = (s: ClientStatus) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const send = () => {
    if (totalSelected === 0) {
      toast.error("No recipients selected.");
      return;
    }
    if (!content.trim()) {
      toast.error("Message body is required.");
      return;
    }
    if (channel === Channel.EMAIL && !subject.trim()) {
      toast.error("Subject is required for email.");
      return;
    }
    startTransition(async () => {
      const res = await sendBulkMessages({
        channel,
        subject: channel === Channel.EMAIL ? subject : undefined,
        content,
        audience:
          audience === "all"
            ? { mode: "all" }
            : { mode: "selected", clientIds: Array.from(selectedIds) },
        statusFilter: statusFilter.size > 0 ? Array.from(statusFilter) : undefined,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Send failed.");
        return;
      }
      setResult(res.data!);
      onSent?.();
      toast.success(
        `Sent ${res.data!.sent} · failed ${res.data!.failed} · skipped ${res.data!.skipped}`,
      );
    });
  };

  const reset = () => {
    setResult(null);
    setSelectedIds(new Set());
    setStatusFilter(new Set());
    setSearch("");
    setSubject("");
    setAudience("all");
    setTab("recipients");
    setContent(channel === Channel.EMAIL ? SAMPLE_TEMPLATES.EMAIL : SAMPLE_TEMPLATES.WHATSAPP);
  };

  const audienceCountLabel =
    statusFilter.size > 0
      ? `Filtered ${statusFiltered.length}/${clients?.length ?? 0}`
      : `All clients (${clients?.length ?? "…"})`;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      {trigger ? <DialogTrigger render={trigger} /> : null}
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bulk message clients</DialogTitle>
        </DialogHeader>

        {result ? (
          <ResultPanel result={result} onClose={() => setOpen(false)} />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bm-channel">Channel</Label>
                <Select
                  items={CHANNEL_OPTIONS}
                  value={channel}
                  onValueChange={(v) => setChannel(v as Channel)}
                >
                  <SelectTrigger id="bm-channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Audience</Label>
                <div className="flex gap-2">
                  <Button
                    size="xs"
                    variant={audience === "all" ? "default" : "outline"}
                    onClick={() => setAudience("all")}
                    type="button"
                  >
                    {audienceCountLabel}
                  </Button>
                  <Button
                    size="xs"
                    variant={audience === "selected" ? "default" : "outline"}
                    onClick={() => setAudience("selected")}
                    type="button"
                  >
                    Selected ({selectedIds.size})
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Filter by client status</Label>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_FILTER_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    size="xs"
                    variant={statusFilter.has(opt.value) ? "default" : "outline"}
                    onClick={() => toggleStatus(opt.value)}
                    type="button"
                  >
                    {opt.label}
                  </Button>
                ))}
                {statusFilter.size > 0 && (
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setStatusFilter(new Set())}
                    type="button"
                  >
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {statusFilter.size === 0
                  ? "Sending to clients of any status."
                  : `Only sending to clients whose status is ${Array.from(statusFilter)
                      .map((s) => STATUS_FILTER_OPTIONS.find((o) => o.value === s)?.label ?? s)
                      .join(", ")}.`}
              </p>
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as "recipients" | "compose")}>
              <TabsList>
                <TabsTab value="recipients">Recipients</TabsTab>
                <TabsTab value="compose">Compose</TabsTab>
              </TabsList>

              <TabsPanel value="recipients">
                <div className="space-y-2">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search clients…"
                    className="h-8"
                  />
                  <div className="max-h-72 overflow-y-auto rounded border">
                    {!clients ? (
                      <div className="p-3 text-xs text-muted-foreground">Loading…</div>
                    ) : filtered.length === 0 ? (
                      <div className="p-3 text-xs text-muted-foreground">No clients.</div>
                    ) : (
                      <ul className="divide-y text-xs">
                        {filtered.map((c) => {
                          const dest =
                            channel === Channel.WHATSAPP ? c.whatsapp ?? c.phone : c.email;
                          return (
                            <li
                              key={c.id}
                              className="flex items-center gap-2 px-2 py-1.5"
                            >
                              <Checkbox
                                checked={selectedIds.has(c.id)}
                                onCheckedChange={() => {
                                  toggle(c.id);
                                  if (audience !== "selected") setAudience("selected");
                                }}
                              />
                              <span className="flex-1 truncate">{c.name}</span>
                              <ClientStatusBadge status={c.status} />
                              <span
                                className={
                                  dest
                                    ? "text-muted-foreground"
                                    : "text-destructive"
                                }
                              >
                                {dest ?? "no destination"}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {audience === "all"
                      ? `Will send to ${reachable} of ${universe.length} clients (others lack a ${channel === Channel.WHATSAPP ? "WhatsApp/phone" : "email"} address).`
                      : `${reachable} of ${universe.length} selected clients have a usable ${channel === Channel.WHATSAPP ? "WhatsApp/phone" : "email"} address${statusFilter.size > 0 ? " and match the status filter" : ""}.`}
                  </p>
                </div>
              </TabsPanel>

              <TabsPanel value="compose">
                <div className="space-y-3">
                  {channel === Channel.EMAIL && (
                    <div className="space-y-1.5">
                      <Label htmlFor="bm-subject">Subject</Label>
                      <Input
                        id="bm-subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="A short update from Drivewell"
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="bm-content">Message</Label>
                    <Textarea
                      id="bm-content"
                      rows={10}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Placeholders:{" "}
                      <Badge variant="outline">{`{{name}}`}</Badge>{" "}
                      <Badge variant="outline">{`{{firstName}}`}</Badge>{" "}
                      <Badge variant="outline">{`{{vehicle}}`}</Badge>{" "}
                      <Badge variant="outline">{`{{phone}}`}</Badge>{" "}
                      <Badge variant="outline">{`{{email}}`}</Badge>
                    </p>
                  </div>
                </div>
              </TabsPanel>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} type="button">
                Cancel
              </Button>
              <Button
                onClick={send}
                disabled={pending || totalSelected === 0}
                type="button"
              >
                {pending
                  ? "Sending…"
                  : `Send to ${reachable} ${reachable === 1 ? "client" : "clients"}`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResultPanel({
  result,
  onClose,
}: {
  result: BulkSendResult;
  onClose: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge>Sent {result.sent}</Badge>
        <Badge variant="outline">Failed {result.failed}</Badge>
        <Badge variant="outline">Skipped {result.skipped}</Badge>
      </div>
      {result.details.length > 0 && (
        <div className="max-h-64 overflow-y-auto rounded border">
          <ul className="divide-y text-xs">
            {result.details.map((d) => (
              <li key={d.clientId} className="flex items-center gap-2 px-2 py-1.5">
                <span className="flex-1 truncate">{d.clientName}</span>
                <span className="text-muted-foreground">{d.destination || "—"}</span>
                <Badge
                  variant={
                    d.state === "SENT"
                      ? "default"
                      : d.state === "FAILED"
                        ? "destructive"
                        : "outline"
                  }
                >
                  {d.state}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.details.some((d) => d.error) && (
        <ul className="space-y-1 text-xs text-destructive">
          {result.details
            .filter((d) => d.error)
            .map((d) => (
              <li key={`err-${d.clientId}`}>
                {d.clientName}: {d.error}
              </li>
            ))}
        </ul>
      )}
      <DialogFooter>
        <Button onClick={onClose} type="button">
          Done
        </Button>
      </DialogFooter>
    </div>
  );
}
