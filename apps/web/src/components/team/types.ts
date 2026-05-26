import type { TaskPriority, TaskStatus } from "@crm-tool/db";

/** Client-safe person shape. */
export interface PersonDTO {
  id: string;
  name: string;
  photo: string | null;
}

/**
 * Client-safe task shape — dates serialized to ISO strings so the row can cross
 * the server→client boundary (server components pass plain objects).
 */
export interface TaskDTO {
  id: string;
  title: string;
  description: string | null;
  date: string;
  dueDate: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: PersonDTO;
  createdBy: PersonDTO;
  overdue: boolean;
  carriedOver: boolean;
}
