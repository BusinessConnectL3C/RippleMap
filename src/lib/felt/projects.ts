import "server-only";
import { feltFetch } from "./client";
import type { FeltProject, FeltProjectReference } from "./types";

/**
 * Project name for an org. Embeds the org id so the "does one already exist"
 * lookup can never match a different org that shares a display name (same
 * convention as the per-org ClickUp list).
 */
export function orgProjectName(orgName: string, orgId: string): string {
  return `RippleMap · ${orgName} · ${orgId.slice(0, 8)}`;
}

/**
 * Ensure a PRIVATE Felt project exists for this org and return its id.
 *
 * Private matters: a "workspace"-visibility project is open to every workspace
 * member, which would include other client orgs' Field Editors. Private
 * projects can't be opened even by workspace admins unless invited.
 */
export async function getOrCreateOrgProject(orgName: string, orgId: string): Promise<string> {
  const name = orgProjectName(orgName, orgId);
  const suffix = ` · ${orgId.slice(0, 8)}`;

  const existing = await feltFetch<FeltProjectReference[]>("/projects");
  // Match on the org-id suffix rather than the full name, so a renamed org
  // still finds its project instead of creating a duplicate.
  const match = existing.find((p) => p.name.startsWith("RippleMap · ") && p.name.endsWith(suffix));
  if (match) {
    if (match.visibility !== "private") {
      throw new Error(
        `Felt project ${match.id} for org ${orgId} is not private — refusing to use it. Fix its visibility in Felt.`
      );
    }
    return match.id;
  }

  const created = await feltFetch<FeltProject>("/projects", {
    method: "POST",
    body: { name, visibility: "private" },
  });
  return created.id;
}

export function getProject(projectId: string): Promise<FeltProject> {
  return feltFetch<FeltProject>(`/projects/${encodeURIComponent(projectId)}`);
}
