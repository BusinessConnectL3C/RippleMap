const CLICKUP_BASE = "https://api.clickup.com/api/v2";

/**
 * Ensure a dedicated ClickUp list exists for this org inside CLICKUP_SUPPORT_FOLDER_ID
 * and return its id. The org id is embedded in the list name so the lookup can never
 * match a different org that happens to share a display name.
 */
export async function getOrCreateOrgList(
  orgName: string,
  orgId: string
): Promise<string> {
  const folderId = process.env.CLICKUP_SUPPORT_FOLDER_ID!;
  const token = process.env.CLICKUP_API_TOKEN!;
  const listName = `${orgName} · ${orgId.slice(0, 8)}`;

  const existingRes = await fetch(`${CLICKUP_BASE}/folder/${folderId}/list`, {
    headers: { Authorization: token },
  });
  if (!existingRes.ok) {
    throw new Error(`Failed to list ClickUp folder lists: ${existingRes.statusText}`);
  }
  const existing = await existingRes.json();
  const match = (existing.lists ?? []).find((l: { name: string }) => l.name === listName);
  if (match) return match.id as string;

  const createRes = await fetch(`${CLICKUP_BASE}/folder/${folderId}/list`, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: listName }),
  });
  if (!createRes.ok) {
    throw new Error(`Failed to create ClickUp list: ${createRes.statusText}`);
  }
  const created = await createRes.json();
  return created.id as string;
}
