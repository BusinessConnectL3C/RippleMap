import "server-only";
import type { FeltMap as FeltMapRow, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { duplicateMapIntoProject } from "./maps";
import type { Viewer } from "./access";
import { isOrgAdmin } from "./access";

/**
 * Template gallery. A template is a registered map with isTemplate = true that
 * lives in a BC-internal org (an org holding a BC staff account). Restricting
 * templates to internal orgs means a client's map, and its data, can never be
 * offered to — and copied into — another client's project.
 */

/** Orgs that hold at least one BC staff account. */
const internalOrg: Prisma.OrganizationWhereInput = { users: { some: { role: "BC_STAFF" } } };

/** Cap on maps per org, so a single org can't fill BC's Felt workspace. */
export const MAX_MAPS_PER_ORG = 25;

export function listTemplates(): Promise<FeltMapRow[]> {
  return db.feltMap.findMany({
    where: { isTemplate: true, organization: internalOrg },
    orderBy: { title: "asc" },
  });
}

export function getTemplate(id: string): Promise<FeltMapRow | null> {
  return db.feltMap.findFirst({ where: { id, isTemplate: true, organization: internalOrg } });
}

export async function isInternalOrg(orgId: string): Promise<boolean> {
  return (await db.organization.count({ where: { id: orgId, ...internalOrg } })) > 0;
}

export class TemplateError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Copy a template into the viewer's org project as a new, private,
 * Restricted map. Org owners/admins only (and BC staff, into their own org).
 */
export async function createMapFromTemplate(viewer: Viewer, templateId: string, title: string): Promise<FeltMapRow> {
  if (viewer.role !== "BC_STAFF" && !isOrgAdmin(viewer)) {
    throw new TemplateError("Only organization owners and admins can create maps", 403);
  }
  const template = await getTemplate(templateId);
  if (!template) throw new TemplateError("That template isn't available", 404);

  const org = await db.organization.findUnique({
    where: { id: viewer.orgId },
    select: { feltProjectId: true, _count: { select: { feltMaps: true } } },
  });
  if (!org?.feltProjectId) {
    throw new TemplateError("Your map workspace is still being set up. Please try again shortly.", 409);
  }
  if (org._count.feltMaps >= MAX_MAPS_PER_ORG) {
    throw new TemplateError(`Your organization has reached its limit of ${MAX_MAPS_PER_ORG} maps. Contact BC to add more.`, 409);
  }

  // Duplicates into the org's project and forces private link sharing.
  const copy = await duplicateMapIntoProject(template.feltMapId, org.feltProjectId, title);
  return db.feltMap.create({
    data: {
      orgId: viewer.orgId,
      feltMapId: copy.id,
      title: copy.title,
      kind: template.kind,
      visibility: "RESTRICTED",
      // Reuse the template's chosen thumbnail framing, if any.
      ...(template.thumbnailView !== null && { thumbnailView: template.thumbnailView as Prisma.InputJsonValue }),
    },
  });
}
