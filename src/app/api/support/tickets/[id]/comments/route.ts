import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { db } from "@/lib/db";
import { createClickUpComment } from "@/lib/clickup/tickets";

const createSchema = z.object({
  body: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const su = session.user as unknown as { orgId: string };
  const [ticket, user] = await Promise.all([
    db.supportTicket.findFirst({ where: { id, orgId: su.orgId } }),
    db.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true } }),
  ]);
  if (!ticket || !user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!ticket.clickupTaskId) {
    return NextResponse.json({ error: "Ticket has no linked ClickUp task" }, { status: 409 });
  }

  let clickupCommentId: string;
  try {
    clickupCommentId = await createClickUpComment(
      ticket.clickupTaskId,
      `${user.name} (${user.email}):\n${parsed.data.body}`
    );
  } catch (err) {
    console.error(`Failed to post ClickUp comment for ticket ${ticket.id}:`, err);
    return NextResponse.json({ error: "Failed to send reply" }, { status: 502 });
  }

  // ClickUp's taskCommentPosted webhook fires for this same comment and can reach
  // syncClickUpComments before this request reaches this point, inserting it as an
  // unattributed BC_STAFF row (it has no way to know this comment is actually ours).
  // upsert so our authoritative CLIENT attribution always wins, regardless of order.
  const comment = await db.supportTicketComment.upsert({
    where: { clickupCommentId },
    create: {
      ticketId: ticket.id,
      clickupCommentId,
      authorName: user.name,
      body: parsed.data.body,
      source: "CLIENT",
    },
    update: {
      authorName: user.name,
      body: parsed.data.body,
      source: "CLIENT",
    },
  });

  return NextResponse.json({ comment }, { status: 201 });
}
