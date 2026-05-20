export type Role = "CLIENT" | "ADMIN";

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
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
