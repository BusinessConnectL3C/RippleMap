import type { Priority, TicketStatus } from "@/types/portal";
import { db } from "@/lib/db";

const CLICKUP_BASE = "https://api.clickup.com/api/v2";

const PRIORITY_MAP: Record<Priority, number> = {
  URGENT: 1,
  HIGH: 2,
  NORMAL: 3,
  LOW: 4,
};

/**
 * ClickUp statuses are custom per list/space (e.g. "waiting for info", "ready for
 * review") and can be renamed at any time, so we never match on the literal status
 * name. Every status does carry a stable `type` — open | custom | done | closed —
 * and that's what we bucket into our own coarse status for filtering/business logic.
 * The literal name is stored separately (`clickupStatus`) purely for display.
 */
const STATUS_TYPE_MAP: Record<string, TicketStatus> = {
  open: "OPEN",
  custom: "IN_PROGRESS",
  done: "RESOLVED",
  closed: "CLOSED",
};

export function mapClickUpStatusType(type: string): TicketStatus {
  return STATUS_TYPE_MAP[type] ?? "IN_PROGRESS";
}

interface CreateTicketParams {
  title: string;
  description: string;
  priority: Priority;
  customerEmail: string;
  /** Org's own ClickUp list. Falls back to the shared CLICKUP_SUPPORT_LIST_ID if the org has none yet. */
  listId?: string;
}

interface CreateTicketResult {
  taskId: string;
  clickupStatus: string | null;
  status: TicketStatus;
}

/** Create a support task in the BC ClickUp workspace and return its ID and initial status. */
export async function createClickUpTicket(
  params: CreateTicketParams
): Promise<CreateTicketResult> {
  const listId = params.listId ?? process.env.CLICKUP_SUPPORT_LIST_ID!;
  const token = process.env.CLICKUP_API_TOKEN!;

  const body = {
    name: params.title,
    description: `${params.description}\n\n---\nSubmitted by: ${params.customerEmail}`,
    priority: PRIORITY_MAP[params.priority],
  };

  const res = await fetch(`${CLICKUP_BASE}/list/${listId}/task`, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`ClickUp task creation failed: ${res.statusText}`);
  }

  const data = await res.json();
  return {
    taskId: String(data.id),
    clickupStatus: data.status?.status ?? null,
    status: mapClickUpStatusType(data.status?.type ?? "open"),
  };
}

/** Fetch a ClickUp task's current status (name and type). */
export async function getClickUpTaskStatus(
  taskId: string
): Promise<{ status: string; type: string } | null> {
  const token = process.env.CLICKUP_API_TOKEN!;

  const res = await fetch(`${CLICKUP_BASE}/task/${taskId}`, {
    headers: { Authorization: token },
  });

  if (!res.ok) return null;
  const data = await res.json();
  if (!data.status?.status || !data.status?.type) return null;
  return { status: data.status.status, type: data.status.type };
}

/** Post a comment on a ClickUp task and return the new comment's ID. */
export async function createClickUpComment(
  taskId: string,
  commentText: string
): Promise<string> {
  const token = process.env.CLICKUP_API_TOKEN!;

  const res = await fetch(`${CLICKUP_BASE}/task/${taskId}/comment`, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ comment_text: commentText }),
  });

  if (!res.ok) {
    throw new Error(`ClickUp comment creation failed: ${res.statusText}`);
  }

  const data = await res.json();
  // ClickUp's create-comment response returns `id` as a JSON number (unlike the
  // list-comments endpoint, which returns it as a string) — coerce explicitly rather
  // than relying on `as string`, which is a type assertion, not a runtime conversion,
  // and Prisma validates the actual runtime type against the schema's String column.
  return String(data.id);
}

/**
 * Pull every comment on a ClickUp task and upsert it locally, keyed on clickupCommentId.
 * Safe to call repeatedly: comments we already have (including ones we posted ourselves
 * via createClickUpComment) are left untouched, so webhook retries and our own outbound
 * replies echoing back through the webhook never create duplicates.
 */
export async function syncClickUpComments(
  taskId: string,
  ticketId: string
): Promise<void> {
  const token = process.env.CLICKUP_API_TOKEN!;

  const res = await fetch(`${CLICKUP_BASE}/task/${taskId}/comment`, {
    headers: { Authorization: token },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ClickUp comments: ${res.statusText}`);
  }

  const data = await res.json();
  const comments: Array<{
    id: string | number;
    comment_text?: string;
    user?: { username?: string };
    date?: string;
  }> = data.comments ?? [];

  for (const comment of comments) {
    // ClickUp's id typing isn't consistent across endpoints (see createClickUpComment) —
    // always coerce to string before it reaches Prisma's strict-typed String column.
    const clickupCommentId = String(comment.id);
    await db.supportTicketComment.upsert({
      where: { clickupCommentId },
      create: {
        ticketId,
        clickupCommentId,
        authorName: comment.user?.username ?? "ClickUp",
        body: comment.comment_text ?? "",
        source: "BC_STAFF",
        createdAt: comment.date ? new Date(Number(comment.date)) : undefined,
      },
      update: {},
    });
  }
}
