import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { TopBar } from "@/components/layout/TopBar";
import { TicketDetail } from "@/components/support/TicketDetail";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SupportTicketPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const su = session.user as unknown as { orgId: string };

  const ticket = await db.supportTicket.findFirst({
    where: { id, orgId: su.orgId },
    include: { comments: { orderBy: { createdAt: "asc" } } },
  });

  if (!ticket) notFound();

  return (
    <div className="flex flex-col h-full">
      <TopBar title={ticket.title} />
      <div className="flex-1 p-6">
        <div className="max-w-2xl">
          <TicketDetail ticket={ticket} />
        </div>
      </div>
    </div>
  );
}
