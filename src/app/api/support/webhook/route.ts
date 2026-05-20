import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const STATUS_MAP: Record<string, "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"> = {
  "open": "OPEN",
  "in progress": "IN_PROGRESS",
  "resolved": "RESOLVED",
  "closed": "CLOSED",
  "complete": "RESOLVED",
};

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.CLICKUP_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  if (body.event === "taskStatusUpdated") {
    const taskId = body.task_id as string;
    const newStatus = (body.history_items?.[0]?.after?.status ?? "").toLowerCase();
    const mappedStatus = STATUS_MAP[newStatus];

    if (taskId && mappedStatus) {
      await db.supportTicket.updateMany({
        where: { clickupTaskId: taskId },
        data: { status: mappedStatus },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
