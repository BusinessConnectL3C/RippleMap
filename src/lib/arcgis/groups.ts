import type { ArcGISGroupItemsResponse, ArcGISItem } from "@/types/arcgis";
import { getBCAppToken } from "./auth";

const AGOL_BASE = "https://www.arcgis.com/sharing/rest";

/** Create a private ArcGIS Online group for a new client using the BC app token. Returns the new group ID. */
export async function createClientGroup(displayName: string): Promise<string> {
  const token = await getBCAppToken();
  const params = new URLSearchParams({
    title: `RippleMap - ${displayName}`,
    access: "private",
    description: "RippleMap client portal group",
    tags: "ripplemap,client",
    token,
    f: "json",
  });

  const res = await fetch(`${AGOL_BASE}/community/createGroup`, {
    method: "POST",
    body: params,
  });

  if (!res.ok) throw new Error(`Failed to create ArcGIS group: ${res.statusText}`);

  const data = await res.json();
  if (data.error) throw new Error(`ArcGIS group creation error: ${data.error.message}`);
  if (!data.group?.id) throw new Error("ArcGIS group creation returned no group ID");

  return data.group.id as string;
}

/** List all items in a group, optionally filtered by type. */
export async function listGroupItems(
  groupId: string,
  type?: string,
  num = 50
): Promise<ArcGISItem[]> {
  const token = await getBCAppToken();
  const params = new URLSearchParams({
    f: "json",
    token,
    num: String(num),
    ...(type ? { q: `type:"${type}"` } : {}),
  });

  const res = await fetch(
    `${AGOL_BASE}/content/groups/${groupId}/items?${params}`
  );
  if (!res.ok) throw new Error(`Failed to list group items: ${res.statusText}`);

  const data: ArcGISGroupItemsResponse = await res.json();
  return data.items ?? [];
}

/** Add a user to an ArcGIS group using BC app credentials. */
export async function addUserToGroup(
  groupId: string,
  username: string
): Promise<void> {
  const token = await getBCAppToken();
  const params = new URLSearchParams({
    users: username,
    token,
    f: "json",
  });

  const res = await fetch(`${AGOL_BASE}/community/groups/${groupId}/addUsers`, {
    method: "POST",
    body: params,
  });

  if (!res.ok) throw new Error(`Failed to add user to group: ${res.statusText}`);

  const data = await res.json();
  if (data.notAdded?.length > 0) {
    throw new Error(`User not added to group: ${JSON.stringify(data.notAdded)}`);
  }
}

/** Remove a user from an ArcGIS group. */
export async function removeUserFromGroup(
  groupId: string,
  username: string
): Promise<void> {
  const token = await getBCAppToken();
  const params = new URLSearchParams({
    users: username,
    token,
    f: "json",
  });

  await fetch(`${AGOL_BASE}/community/groups/${groupId}/removeUsers`, {
    method: "POST",
    body: params,
  });
}
