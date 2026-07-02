import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";

const STATUS_MAP: Record<string, "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"> = {
  "open": "OPEN",
  "in progress": "IN_PROGRESS",
  "resolved": "RESOLVED",
  "closed": "CLOSED",
  "complete": "RESOLVED",
};

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
