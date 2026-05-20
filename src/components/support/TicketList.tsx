import type { SupportTicket, TicketStatus, Priority } from "@/types/portal";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";

const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

const STATUS_VARIANTS: Record<TicketStatus, "default" | "warning" | "success" | "secondary"> = {
  OPEN: "default",
  IN_PROGRESS: "warning",
  RESOLVED: "success",
  CLOSED: "secondary",
};

const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

const PRIORITY_VARIANTS: Record<Priority, "secondary" | "warning" | "destructive" | "outline"> = {
  LOW: "secondary",
  NORMAL: "outline",
  HIGH: "warning",
  URGENT: "destructive",
};

interface Props {
  tickets: SupportTicket[];
}

export function TicketList({ tickets }: Props) {
  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <MessageSquare className="h-14 w-14 text-gray-300 mb-3" />
        <p className="text-lg font-medium text-gray-700">No support tickets yet</p>
        <p className="text-sm text-gray-400 mt-1">Submit a ticket and our team will respond promptly.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tickets.map((ticket) => (
        <div key={ticket.id} className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900">{ticket.title}</h3>
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{ticket.description}</p>
              <p className="text-xs text-gray-400 mt-2">
                {new Date(ticket.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex flex-col gap-1 items-end shrink-0">
              <Badge variant={STATUS_VARIANTS[ticket.status]}>
                {STATUS_LABELS[ticket.status]}
              </Badge>
              <Badge variant={PRIORITY_VARIANTS[ticket.priority]}>
                {PRIORITY_LABELS[ticket.priority]}
              </Badge>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
