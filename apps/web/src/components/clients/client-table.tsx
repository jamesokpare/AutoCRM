"use client";

import { OrderStatus } from "@crm-tool/db/enums";
import { Button } from "@crm-tool/ui/components/button";
import { Checkbox } from "@crm-tool/ui/components/checkbox";
import { Input } from "@crm-tool/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@crm-tool/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@crm-tool/ui/components/table";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";

import { listClientsAction } from "@/lib/actions/clients";
import type { ClientListFilters, ClientListRow } from "@/lib/queries/clients";

import { BulkMessageDialog } from "./bulk-message-dialog";
import { ClientRowDeleteButton } from "./client-actions";
import { ClientBulkStatusDialog } from "./client-bulk-status-dialog";
import { ClientStatusBadge, OrderPartsBadge, ServiceStatusBadge, StatusBadge } from "./status-badge";

type QuickFilter = NonNullable<ClientListFilters["quick"]>;

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: "failed", label: "Failed" },
  { key: "due_today", label: "Due today" },
  { key: "parts_not_available", label: "Parts not available" },
];

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  FAILED: "Failed",
  ON_HOLD: "On Hold",
  CUSTOMER_CANCELLED: "Customer cancelled",
};

// "All statuses" clears the order-status filter (the dropdown can't be left
// blank once opened, so we model "no filter" as an explicit option).
const STATUS_ALL = "ALL";
const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: STATUS_ALL, label: "All statuses" },
  ...Object.values(OrderStatus).map((s) => ({ value: s, label: STATUS_LABEL[s] })),
];

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Picks the order to summarise for a client row: the most recently updated. */
function primaryOrder(client: ClientListRow): ClientListRow["orders"][number] | undefined {
  return client.orders[0];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Recency buckets used to group clients in the list. Order matters — rows fall
 *  into the first bucket whose `maxAgeDays` they satisfy. */
const RECENCY_BUCKETS: { key: string; label: string; maxAgeDays: number | null }[] = [
  { key: "2w", label: "Last 2 weeks", maxAgeDays: 14 },
  { key: "1m", label: "2 weeks – 1 month", maxAgeDays: 30 },
  { key: "3m", label: "1 – 3 months", maxAgeDays: 90 },
  { key: "6m", label: "3 – 6 months", maxAgeDays: 180 },
  { key: "1y", label: "6 months – 1 year", maxAgeDays: 365 },
  { key: "older", label: "Over a year ago", maxAgeDays: null },
];

/** Most recent of: client createdAt, or latest communication (sentAt fallback createdAt). */
function lastActivityAt(client: ClientListRow): Date {
  const created = new Date(client.createdAt).getTime();
  const comm = client.communications[0];
  const commTs = comm ? new Date(comm.sentAt ?? comm.createdAt).getTime() : 0;
  return new Date(Math.max(created, commTs));
}

function bucketIndex(activity: Date, now: number): number {
  const ageDays = (now - activity.getTime()) / DAY_MS;
  for (let i = 0; i < RECENCY_BUCKETS.length; i++) {
    const max = RECENCY_BUCKETS[i].maxAgeDays;
    if (max === null || ageDays <= max) return i;
  }
  return RECENCY_BUCKETS.length - 1;
}

export function ClientTable({
  initialData,
  initialFilters = {},
  canBulkSend = false,
}: {
  initialData: ClientListRow[];
  initialFilters?: ClientListFilters;
  /** Drives whether the "Bulk message selected" button shows in the toolbar. */
  canBulkSend?: boolean;
}) {
  const [search, setSearch] = useState(initialFilters.search ?? "");
  const [debounced, setDebounced] = useState(initialFilters.search ?? "");
  const [quick, setQuick] = useState<QuickFilter | undefined>(initialFilters.quick);
  const [status, setStatus] = useState<OrderStatus | undefined>(initialFilters.status);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMessageOpen, setBulkMessageOpen] = useState(false);

  // Debounce the text search to avoid a query per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filters: ClientListFilters = {
    search: debounced || undefined,
    quick,
    status,
  };

  const { data, isFetching } = useQuery({
    queryKey: ["clients", filters],
    queryFn: () => listClientsAction(filters),
    initialData:
      debounced === (initialFilters.search ?? "") &&
      quick === initialFilters.quick &&
      status === initialFilters.status
        ? initialData
        : undefined,
    placeholderData: keepPreviousData,
    // Inherits refetchOnWindowFocus from the global QueryClient (SPEC §2).
  });

  const rawRows = data ?? [];

  // Sort by most recent activity (added or last contacted) descending so the
  // recency buckets render in order. Computed once per data change.
  const rows = useMemo(() => {
    return [...rawRows].sort(
      (a, b) => lastActivityAt(b).getTime() - lastActivityAt(a).getTime(),
    );
  }, [rawRows]);

  // Pre-compute the bucket boundaries so each render of the table body knows
  // exactly where to slot in a separator row.
  const bucketed = useMemo(() => {
    const now = Date.now();
    const result: { bucketIdx: number; row: ClientListRow }[] = [];
    for (const row of rows) {
      result.push({ bucketIdx: bucketIndex(lastActivityAt(row), now), row });
    }
    return result;
  }, [rows]);

  // Prune selected IDs that are no longer in the visible result set when
  // filters or the search query change — otherwise a bulk action could fire
  // against rows the user can no longer see (and therefore can't reason about).
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const visible = new Set(rows.map((r) => r.id));
    let changed = false;
    const next = new Set<string>();
    for (const id of selectedIds) {
      if (visible.has(id)) next.add(id);
      else changed = true;
    }
    if (changed) setSelectedIds(next);
    // Intentionally omit selectedIds from deps to avoid a render loop — we only
    // re-prune when the row set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const selectedIdsArray = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const allVisibleSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const someVisibleSelected = rows.some((r) => selectedIds.has(r.id));

  const toggleRow = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const r of rows) next.delete(r.id);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const r of rows) next.add(r.id);
        return next;
      });
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, contact, or vehicle…"
          className="h-8 max-w-xs"
        />
        <div className="flex flex-wrap gap-1.5">
          {QUICK_FILTERS.map((f) => (
            <Button
              key={f.key}
              size="xs"
              variant={quick === f.key ? "default" : "outline"}
              onClick={() => setQuick((cur) => (cur === f.key ? undefined : f.key))}
            >
              {f.label}
            </Button>
          ))}
          <Select
            items={STATUS_FILTER_OPTIONS}
            value={status ?? STATUS_ALL}
            onValueChange={(value) =>
              setStatus(value === STATUS_ALL ? undefined : (value as OrderStatus))
            }
          >
            <SelectTrigger className="h-8 w-40" aria-label="Filter by status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isFetching ? <span className="text-xs text-muted-foreground">Updating…</span> : null}
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded border bg-muted/40 px-2 py-1.5 text-xs">
          <span className="font-medium">
            {selectedIds.size} selected
          </span>
          <ClientBulkStatusDialog
            clientIds={selectedIdsArray}
            onApplied={clearSelection}
            trigger={
              <Button size="xs" variant="outline">
                Set status…
              </Button>
            }
          />
          {canBulkSend && (
            <Button
              size="xs"
              variant="outline"
              onClick={() => setBulkMessageOpen(true)}
            >
              Bulk message selected…
            </Button>
          )}
          <Button size="xs" variant="ghost" onClick={clearSelection}>
            Clear
          </Button>
        </div>
      )}

      {canBulkSend && (
        <BulkMessageDialog
          open={bulkMessageOpen}
          onOpenChange={setBulkMessageOpen}
          initialClientIds={selectedIdsArray}
          onSent={clearSelection}
        />
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox
                  checked={allVisibleSelected}
                  indeterminate={!allVisibleSelected && someVisibleSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all visible clients"
                />
              </TableHead>
              <TableHead>Customer Name</TableHead>
              <TableHead>Phone / Email</TableHead>
              <TableHead>Client Status</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>VIN</TableHead>
              <TableHead>Order ID</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Item / Part Requested</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Parts</TableHead>
              <TableHead>Expected</TableHead>
              <TableHead>Tech</TableHead>
              <TableHead>Last update</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {bucketed.length === 0 ? (
              <TableRow>
                <TableCell colSpan={15} className="text-center text-muted-foreground">
                  No clients match these filters.
                </TableCell>
              </TableRow>
            ) : (
              bucketed.map(({ row: client, bucketIdx }, i) => {
                const order = primaryOrder(client);
                const vehicle = order?.vehicle ?? client.vehicles[0];
                const isSelected = selectedIds.has(client.id);
                const prevBucketIdx = i === 0 ? -1 : bucketed[i - 1].bucketIdx;
                const showHeader = bucketIdx !== prevBucketIdx;
                return (
                  <Fragment key={client.id}>
                    {showHeader && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell
                          colSpan={15}
                          className="border-y bg-muted/40 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          {RECENCY_BUCKETS[bucketIdx].label}
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow data-state={isSelected ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRow(client.id)}
                        aria-label={`Select ${client.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/clients/${client.id}`} className="hover:underline">
                        {client.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs">
                        {client.phone ? <span>{client.phone}</span> : null}
                        {client.email ? <span className="text-muted-foreground">{client.email}</span> : null}
                        {!client.phone && !client.email ? <span className="text-muted-foreground">—</span> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ClientStatusBadge status={client.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {vehicle
                        ? `${vehicle.make} ${vehicle.model}${vehicle.year ? ` (${vehicle.year})` : ""}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {vehicle?.vin ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {order?.externalOrderId ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[14rem] truncate text-xs">
                      {order?.description ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {order?.itemRequested ?? "—"}
                    </TableCell>
                    <TableCell>
                      {client.serviceStatus || order ? (
                        <div className="flex flex-col gap-1">
                          {client.serviceStatus ? (
                            <ServiceStatusBadge status={client.serviceStatus} />
                          ) : null}
                          {order ? <StatusBadge status={order.status} /> : null}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {order ? <OrderPartsBadge parts={order.parts} /> : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDate(order?.expectedDate ?? null)}</TableCell>
                    <TableCell>
                      {order?.assignedTechName ?? order?.assignedTech?.name ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {fmtDate(order?.updatedAt ?? client.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <ClientRowDeleteButton clientId={client.id} clientName={client.name} />
                    </TableCell>
                  </TableRow>
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
