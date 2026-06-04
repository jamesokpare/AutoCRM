import { ClientStatus, OrderStatus, PartAvailability, ServiceStatus } from "@crm-tool/db/enums";
import { Badge } from "@crm-tool/ui/components/badge";
import { cn } from "@crm-tool/ui/lib/utils";
import { CalendarClock } from "lucide-react";

import { bucketByDueAt } from "@/components/ops/wat";

/**
 * DASH-02 colour-coded order status badge.
 * Pending=amber, In Progress=blue, Completed=green, Failed=red, On Hold=grey.
 */
const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  FAILED: "Failed",
  ON_HOLD: "On Hold",
  CUSTOMER_CANCELLED: "Customer cancelled",
};

const STATUS_CLASS: Record<OrderStatus, string> = {
  PENDING: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400",
  IN_PROGRESS: "border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-400",
  COMPLETED: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  FAILED: "border-transparent bg-red-500/15 text-red-700 dark:text-red-400",
  ON_HOLD: "border-transparent bg-muted text-muted-foreground",
  CUSTOMER_CANCELLED: "border-transparent bg-muted text-muted-foreground",
};

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center rounded-none px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        STATUS_CLASS[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

// A "due today" nudge only makes sense while the job is still open — a
// completed or failed order is no longer waiting on anyone.
const DUE_TODAY_IRRELEVANT: OrderStatus[] = [
  OrderStatus.COMPLETED,
  OrderStatus.FAILED,
  OrderStatus.CUSTOMER_CANCELLED,
];

/**
 * "Due today" indicator for an order. Renders only when the order's expected
 * date falls on the current WAT calendar day (SPEC §7) and the job is still
 * open. Returns null otherwise so it can be dropped inline next to the status.
 */
export function DueTodayBadge({
  expectedDate,
  status,
  className,
}: {
  expectedDate: Date | string | null;
  status: OrderStatus;
  className?: string;
}) {
  if (!expectedDate) return null;
  if (DUE_TODAY_IRRELEVANT.includes(status)) return null;
  if (bucketByDueAt(new Date(expectedDate)) !== "today") return null;

  return (
    <Badge variant="warning" className={cn("gap-1", className)}>
      <CalendarClock className="size-3" />
      Due today
    </Badge>
  );
}

const PART_LABEL: Record<PartAvailability, string> = {
  AVAILABLE: "Available",
  NOT_AVAILABLE: "Not available",
  ON_ORDER: "On order",
};

const PART_VARIANT: Record<PartAvailability, "success" | "warning" | "destructive"> = {
  AVAILABLE: "success",
  NOT_AVAILABLE: "destructive",
  ON_ORDER: "warning",
};

export function PartAvailabilityBadge({ availability }: { availability: PartAvailability }) {
  return <Badge variant={PART_VARIANT[availability]}>{PART_LABEL[availability]}</Badge>;
}

const CLIENT_STATUS_LABEL: Record<ClientStatus, string> = {
  PROSPECT: "Prospect",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ARCHIVED: "Archived",
};

const CLIENT_STATUS_CLASS: Record<ClientStatus, string> = {
  PROSPECT: "border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-400",
  ACTIVE: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  INACTIVE: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400",
  ARCHIVED: "border-transparent bg-muted text-muted-foreground",
};

export function ClientStatusBadge({
  status,
  className,
}: {
  status: ClientStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center rounded-none px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        CLIENT_STATUS_CLASS[status],
        className,
      )}
    >
      {CLIENT_STATUS_LABEL[status]}
    </span>
  );
}

const SERVICE_STATUS_LABEL: Record<ServiceStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  FAILED: "Failed",
  ON_HOLD: "On Hold",
  DUE_TODAY: "Due today",
  PARTS_NOT_AVAILABLE: "Parts not available",
  CUSTOMER_CANCELLED: "Customer cancelled",
};

const SERVICE_STATUS_CLASS: Record<ServiceStatus, string> = {
  PENDING: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400",
  IN_PROGRESS: "border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-400",
  COMPLETED: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  FAILED: "border-transparent bg-red-500/15 text-red-700 dark:text-red-400",
  ON_HOLD: "border-transparent bg-muted text-muted-foreground",
  DUE_TODAY: "border-transparent bg-orange-500/15 text-orange-700 dark:text-orange-400",
  PARTS_NOT_AVAILABLE: "border-transparent bg-red-500/15 text-red-700 dark:text-red-400",
  CUSTOMER_CANCELLED: "border-transparent bg-muted text-muted-foreground",
};

/** Manually-set client service status badge (CLT). */
export function ServiceStatusBadge({
  status,
  className,
}: {
  status: ServiceStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center rounded-none px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        SERVICE_STATUS_CLASS[status],
        className,
      )}
    >
      {SERVICE_STATUS_LABEL[status]}
    </span>
  );
}

/**
 * Free-text service status badge — rendered when a client has a custom
 * `serviceStatusCustom` set. Neutral colour since the text is arbitrary.
 */
export function CustomServiceStatusBadge({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center rounded-none border-transparent bg-purple-500/15 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-purple-700 dark:text-purple-400",
        className,
      )}
    >
      {label}
    </span>
  );
}

/** Aggregate parts availability for an order's whole parts list (DASH column). */
export function OrderPartsBadge({ parts }: { parts: { availability: PartAvailability }[] }) {
  if (parts.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  const anyMissing = parts.some((p) => p.availability === PartAvailability.NOT_AVAILABLE);
  const anyOnOrder = parts.some((p) => p.availability === PartAvailability.ON_ORDER);
  if (anyMissing) return <PartAvailabilityBadge availability={PartAvailability.NOT_AVAILABLE} />;
  if (anyOnOrder) return <PartAvailabilityBadge availability={PartAvailability.ON_ORDER} />;
  return <PartAvailabilityBadge availability={PartAvailability.AVAILABLE} />;
}
