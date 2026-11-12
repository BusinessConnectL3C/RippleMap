import "server-only";
import { db } from "@/lib/db";
import { getOrCreateOrgList } from "@/lib/clickup/lists";
import { isFeltConfigured } from "@/lib/felt/client";
import { getOrCreateOrgProject } from "@/lib/felt/projects";

/**
 * Create an org's outside resources: its ClickUp support list and its private
 * Felt project. Runs once the org's owner has verified their email (not at
 * registration), so unverified sign-ups can't create projects in BC's Felt
 * workspace or lists in ClickUp. Idempotent and best-effort: anything that
 * fails can be retried by BC staff from the admin org page.
 */
export async function provisionOrg(orgId: string): Promise<void> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { name: true, clickupListId: true, feltProjectId: true },
  });
  if (!org) return;

  if (!org.clickupListId) {
    try {
      const listId = await getOrCreateOrgList(org.name, orgId);
      await db.organization.update({ where: { id: orgId }, data: { clickupListId: listId } });
    } catch (err) {
      console.error(`Failed to create ClickUp list for org ${orgId}:`, err);
    }
  }

  if (!org.feltProjectId && isFeltConfigured()) {
    try {
      const projectId = await getOrCreateOrgProject(org.name, orgId);
      await db.organization.update({ where: { id: orgId }, data: { feltProjectId: projectId } });
    } catch (err) {
      console.error(`Failed to create Felt project for org ${orgId}:`, err);
    }
  }
}
