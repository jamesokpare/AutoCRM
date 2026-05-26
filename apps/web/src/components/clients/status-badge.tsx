import { OrderStatus, PartAvailability } from "@crm-tool/db/enums";
import { Badge } from "@crm-tool/ui/components/badge";
import { cn } from "@crm-tool/ui/lib/utils";

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
};

const STATUS_CLASS: Record<OrderStatus, string> = {
  PENDING: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400",
  IN_PROGRESS: "border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-400",
  COMPLETED: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  FAILED: "border-transparent bg-red-500/15 text-red-700 dark:text-red-400",
  ON_HOLD: "border-transparent bg-muted text-muted-foreground",
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
