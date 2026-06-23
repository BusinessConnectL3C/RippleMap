export type OrgType = "NONPROFIT" | "CORPORATE";

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

export interface DashboardStats {
  openTickets: number;
  mapCount: number;
  formCount: number;
}
