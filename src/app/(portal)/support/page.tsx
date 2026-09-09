import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { TopBar } from "@/components/layout/TopBar";
import { TicketList } from "@/components/support/TicketList";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function SupportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const su = session.user as unknown as { orgId: string };
  const tickets = await db.supportTicket.findMany({
    where: { orgId: su.orgId },
    orderBy: { createdAt: "desc" },
  });

  const openTickets = tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS");
  const completedTickets = tickets.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED");

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Support" />
      <div className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            <span className="font-mono font-semibold text-text-primary">{tickets.length}</span> total tickets
          </p>
          <Link href="/support/new">
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> New Ticket
            </Button>
          </Link>
        </div>

        <p className="text-sm text-text-secondary">
          Please allow 24-48 hours for normal replies, and 12-24 hours for urgent requests.
        </p>

        {tickets.length === 0 ? (
          <TicketList tickets={[]} />
        ) : (
          <>
            <div className="space-y-3">
              <h2 className="font-display text-base font-semibold text-text-primary">Open Tickets</h2>
              {openTickets.length > 0 ? (
                <TicketList tickets={openTickets} />
              ) : (
                <p className="text-sm text-text-secondary">No open tickets right now.</p>
              )}
            </div>

            {completedTickets.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-display text-base font-semibold text-text-primary">Completed Tickets</h2>
                <TicketList tickets={completedTickets} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
