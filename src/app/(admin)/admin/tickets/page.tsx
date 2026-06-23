import Link from "next/link";
import { db } from "@/lib/db";
import { TopBar } from "@/components/layout/TopBar";
import { Badge } from "@/components/ui/badge";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "destructive"> = {
  OPEN: "default",
  IN_PROGRESS: "default",
  RESOLVED: "success",
  CLOSED: "secondary",
};

const PRIORITY_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  LOW: "secondary",
  NORMAL: "default",
  HIGH: "default",
  URGENT: "destructive",
};

export default async function AdminTicketsPage() {
  const tickets = await db.supportTicket.findMany({
    orderBy: { createdAt: "desc" },
    include: { organization: { select: { id: true, name: true } } },
  });

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Support Tickets" />
      <div className="flex-1 p-6">
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-700">Organization</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Title</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Priority</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">ClickUp</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/organizations/${ticket.organization.id}`}
                      className="text-[#1B4F72] hover:underline font-medium"
                    >
                      {ticket.organization.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-900 max-w-xs truncate">{ticket.title}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[ticket.status] ?? "secondary"}>
                      {ticket.status.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={PRIORITY_VARIANT[ticket.priority] ?? "secondary"}>
                      {ticket.priority}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                    {ticket.clickupTaskId ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {tickets.length === 0 && (
            <div className="py-16 text-center text-gray-500 text-sm">No tickets yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
