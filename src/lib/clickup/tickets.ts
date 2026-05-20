import type { Priority } from "@/types/portal";

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
}

/** Create a support task in the BC ClickUp workspace and return the task ID. */
export async function createClickUpTicket(
  params: CreateTicketParams
): Promise<string> {
  const listId = process.env.CLICKUP_SUPPORT_LIST_ID!;
  const token = process.env.CLICKUP_API_TOKEN!;

  const body = {
    name: params.title,
    description: params.description,
    priority: PRIORITY_MAP[params.priority],
    custom_fields: [
      {
        name: "Customer Email",
        value: params.customerEmail,
      },
    ],
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
