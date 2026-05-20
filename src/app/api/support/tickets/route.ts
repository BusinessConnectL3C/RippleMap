import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { db } from "@/lib/db";
import { createClickUpTicket } from "@/lib/clickup/tickets";

const createSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tickets = await db.supportTicket.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ tickets });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let clickupTaskId: string | undefined;
  try {
    clickupTaskId = await createClickUpTicket({
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      customerEmail: user.email,
    });
  } catch (err) {
    console.error("ClickUp ticket creation failed:", err);
    // Ticket still saved locally even if ClickUp fails
  }

  const ticket = await db.supportTicket.create({
    data: {
      userId: session.user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      clickupTaskId: clickupTaskId ?? null,
    },
  });

  return NextResponse.json({ ticket }, { status: 201 });
}
