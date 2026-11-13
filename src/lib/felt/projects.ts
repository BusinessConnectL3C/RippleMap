import "server-only";
import { db } from "@/lib/db";
import { FeltApiError, feltFetch } from "./client";
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

/** Felt ids are URL-safe base62-ish strings; accept an id or a Felt project link. */
export function parseFeltProjectId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  let candidate = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const segments = new URL(raw).pathname.split("/").filter(Boolean);
      candidate = segments[segments.length - 1] ?? "";
    } catch {
      return null;
    }
    // Felt links put a readable slug before the id: "My-Project-<id>".
    if (candidate.includes("-")) candidate = candidate.slice(candidate.lastIndexOf("-") + 1);
  }
  return /^[A-Za-z0-9]{8,40}$/.test(candidate) ? candidate : null;
}

export class ProjectLinkError extends Error {}

/**
 * Check an existing Felt project before attaching it to an org: reachable with
 * the portal's token, private (a workspace-visible project is open to every
 * client's Field Editors), and not already attached to another org.
 */
export async function validateExistingProject(input: string, orgId?: string): Promise<string> {
  const projectId = parseFeltProjectId(input);
  if (!projectId) throw new ProjectLinkError("That isn't a Felt project id or link.");
  let project: FeltProject;
  try {
    project = await getProject(projectId);
  } catch (err) {
    if (err instanceof FeltApiError && (err.status === 404 || err.status === 403)) {
      throw new ProjectLinkError(
        "Felt project not found, or the portal's Felt account isn't a member of it. Invite that account to the project in Felt first."
      );
    }
    throw err;
  }
  if (project.visibility !== "private") {
    throw new ProjectLinkError(
      "That project is visible to the whole Felt workspace, which includes other clients' Field Editors. Make it private in Felt first."
    );
  }
  const taken = await db.organization.findFirst({
    where: { feltProjectId: project.id, ...(orgId && { id: { not: orgId } }) },
    select: { name: true },
  });
  if (taken) throw new ProjectLinkError(`That project is already connected to ${taken.name}.`);
  return project.id;
}
