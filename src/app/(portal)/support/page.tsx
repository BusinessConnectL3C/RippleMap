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

  const tickets = await db.supportTicket.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Support" />
      <div className="flex-1 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{tickets.length} total tickets</p>
          <Link href="/support/new">
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> New Ticket
            </Button>
          </Link>
        </div>
        <TicketList tickets={tickets} />
      </div>
    </div>
  );
}
