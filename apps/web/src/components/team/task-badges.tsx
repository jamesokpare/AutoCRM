import { TaskPriority, TaskStatus } from "@crm-tool/db/enums";
import { Badge } from "@crm-tool/ui/components/badge";

const STATUS_VARIANT: Record<TaskStatus, "secondary" | "warning" | "success" | "destructive"> = {
  [TaskStatus.PENDING]: "secondary",
  [TaskStatus.IN_PROGRESS]: "warning",
  [TaskStatus.COMPLETED]: "success",
  [TaskStatus.FAILED]: "destructive",
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  [TaskStatus.PENDING]: "Pending",
  [TaskStatus.IN_PROGRESS]: "In Progress",
  [TaskStatus.COMPLETED]: "Completed",
  [TaskStatus.FAILED]: "Failed",
};

const PRIORITY_VARIANT: Record<TaskPriority, "outline" | "secondary" | "warning" | "destructive"> = {
  [TaskPriority.LOW]: "outline",
  [TaskPriority.MEDIUM]: "secondary",
  [TaskPriority.HIGH]: "warning",
  [TaskPriority.URGENT]: "destructive",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <Badge variant={PRIORITY_VARIANT[priority]}>
      {priority.charAt(0) + priority.slice(1).toLowerCase()}
    </Badge>
  );
}

export { STATUS_LABEL };
