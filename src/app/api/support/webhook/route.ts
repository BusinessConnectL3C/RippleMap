import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { getClickUpTaskStatus, mapClickUpStatusType, syncClickUpComments } from "@/lib/clickup/tickets";

/** ClickUp signs webhook payloads with the webhook's `secret` (returned when the
 * webhook is created via their API) as an HMAC-SHA256 hex digest of the raw body,
 * sent in the `X-Signature` header. It does not support a static bearer-style header. */
function hasValidSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", process.env.CLICKUP_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(signature, "utf8");
  return expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!hasValidSignature(rawBody, req.headers.get("x-signature"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = JSON.parse(rawBody);
  const taskId = body.task_id as string | undefined;

  if (taskId && body.event === "taskStatusUpdated") {
    // Re-fetch the task rather than trust the webhook's embedded history_item: it's
    // the only place guaranteed to carry the status's `type` (open/custom/done/closed),
    // which is what lets us bucket a custom, renameable ClickUp status correctly.
    const current = await getClickUpTaskStatus(taskId);
    if (current) {
      await db.supportTicket.updateMany({
        where: { clickupTaskId: taskId },
        data: { status: mapClickUpStatusType(current.type), clickupStatus: current.status },
      });
    }
  }

  if (taskId && body.event === "taskCommentPosted") {
    const ticket = await db.supportTicket.findFirst({ where: { clickupTaskId: taskId } });
    if (ticket) {
      await syncClickUpComments(taskId, ticket.id);
    }
  }

  return NextResponse.json({ ok: true });
}
