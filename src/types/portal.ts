export type OrgType = "NONPROFIT" | "CORPORATE";

export function orgTypeLabel(type: OrgType | string): string {
  return type === "NONPROFIT" ? "Nonprofit" : "Corporate";
}

export type Role = "OWNER" | "ADMIN" | "MEMBER" | "BC_STAFF";

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  orgId: string;
  onboardingCompleted: boolean;
}

export type CommentSource = "CLIENT" | "BC_STAFF";

export interface TicketComment {
  id: string;
  authorName: string;
  body: string;
  source: CommentSource;
  createdAt: Date | string;
}

export interface SupportTicket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: Priority;
  clickupTaskId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface SupportTicketWithComments extends SupportTicket {
  comments: TicketComment[];
}

export interface DashboardStats {
  openTickets: number;
  mapCount: number;
  formCount: number;
}
