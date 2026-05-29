"use client";

import { OrderStatus } from "@crm-tool/db/enums";
import { Button } from "@crm-tool/ui/components/button";
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
import { useEffect, useState } from "react";

import { listClientsAction } from "@/lib/actions/clients";
import type { ClientListFilters, ClientListRow } from "@/lib/queries/clients";

import { ClientRowDeleteButton } from "./client-actions";
import { ClientStatusBadge, OrderPartsBadge, StatusBadge } from "./status-badge";

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

export function ClientTable({
  initialData,
  initialFilters = {},
}: {
  initialData: ClientListRow[];
  initialFilters?: ClientListFilters;
}) {
  const [search, setSearch] = useState(initialFilters.search ?? "");
  const [debounced, setDebounced] = useState(initialFilters.search ?? "");
  const [quick, setQuick] = useState<QuickFilter | undefined>(initialFilters.quick);
  const [status, setStatus] = useState<OrderStatus | undefined>(initialFilters.status);

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

  const rows = data ?? [];

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

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Client status</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Parts</TableHead>
              <TableHead>Expected</TableHead>
              <TableHead>Tech</TableHead>
              <TableHead>Last update</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">
                  No clients match these filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((client) => {
                const order = primaryOrder(client);
                const vehicle = order?.vehicle ?? client.vehicles[0];
                return (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">
                      <Link href={`/clients/${client.id}`} className="hover:underline">
                        {client.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {client.phone ?? client.email ?? ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ClientStatusBadge status={client.status} />
                    </TableCell>
                    <TableCell>
                      {vehicle
                        ? `${vehicle.make} ${vehicle.model}${"year" in vehicle ? ` (${vehicle.year})` : ""}`
                        : "—"}
                    </TableCell>
                    <TableCell className="max-w-[16rem] truncate">
                      {order ? order.description : <span className="text-muted-foreground">No orders</span>}
                    </TableCell>
                    <TableCell>{order ? <StatusBadge status={order.status} /> : "—"}</TableCell>
                    <TableCell>
                      {order ? <OrderPartsBadge parts={order.parts} /> : "—"}
                    </TableCell>
                    <TableCell>{fmtDate(order?.expectedDate ?? null)}</TableCell>
                    <TableCell>
                      {order?.assignedTechName ?? order?.assignedTech?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fmtDate(order?.updatedAt ?? client.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <ClientRowDeleteButton clientId={client.id} clientName={client.name} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
