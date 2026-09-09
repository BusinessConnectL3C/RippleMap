import type { Priority } from "@/types/portal";
import { db } from "@/lib/db";

const CLICKUP_BASE = "https://api.clickup.com/api/v2";

const PRIORITY_MAP: Record<Priority, number> = {
  URGENT: 1,
  HIGH: 2,
  NORMAL: 3,
  LOW: 4,
};

interface CreateTicketParams {
  title: string;
  description: string;
  priority: Priority;
  customerEmail: string;
  /** Org's own ClickUp list. Falls back to the shared CLICKUP_SUPPORT_LIST_ID if the org has none yet. */
  listId?: string;
}

/** Create a support task in the BC ClickUp workspace and return the task ID. */
export async function createClickUpTicket(
  params: CreateTicketParams
): Promise<string> {
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
  return data.id as string;
}

/** Fetch a ClickUp task to get its current status. */
export async function getClickUpTaskStatus(
  taskId: string
): Promise<string | null> {
  const token = process.env.CLICKUP_API_TOKEN!;

  const res = await fetch(`${CLICKUP_BASE}/task/${taskId}`, {
    headers: { Authorization: token },
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.status?.status ?? null;
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
  return data.id as string;
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
    id: string;
    comment_text?: string;
    user?: { username?: string };
    date?: string;
  }> = data.comments ?? [];

  for (const comment of comments) {
    await db.supportTicketComment.upsert({
      where: { clickupCommentId: comment.id },
      create: {
        ticketId,
        clickupCommentId: comment.id,
        authorName: comment.user?.username ?? "ClickUp",
        body: comment.comment_text ?? "",
        source: "BC_STAFF",
        createdAt: comment.date ? new Date(Number(comment.date)) : undefined,
      },
      update: {},
    });
  }
}
