import "server-only";
import type { FeltMap as FeltMapRow, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * RippleMap-side view permissions for Felt maps.
 *
 * Felt can't express per-portal-user access (portal users have no Felt
 * accounts), so this module is the whole permission system for viewing: a map
 * is visible only if canViewMap() says so, and the portal refuses to mint an
 * embed token otherwise. Every route that lists, shows, exports, or mints a
 * token for a Felt map must go through these helpers.
 *
 *   BC_STAFF       → every map in every org (system admin)
 *   OWNER / ADMIN  → every map in their own org
 *   MEMBER         → own-org maps that are ALL_MEMBERS, plus explicit grants
 *
 * The viewer is re-read from the database rather than trusted from the JWT, so
 * a role change or removal takes effect on the next request, not next login.
 */

export interface Viewer {
  id: string;
  email: string;
  orgId: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "BC_STAFF";
}

export async function getViewer(userId: string): Promise<Viewer | null> {
  return db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, orgId: true, role: true },
  });
}

export function isOrgAdmin(viewer: Viewer): boolean {
  return viewer.role === "OWNER" || viewer.role === "ADMIN";
}

/** Prisma filter for the maps a viewer may see. */
function visibleMapsWhere(viewer: Viewer): Prisma.FeltMapWhereInput {
  if (viewer.role === "BC_STAFF") return {};
  if (isOrgAdmin(viewer)) return { orgId: viewer.orgId };
  return {
    orgId: viewer.orgId,
    OR: [{ visibility: "ALL_MEMBERS" }, { grants: { some: { userId: viewer.id } } }],
  };
}

/** Maps visible to the viewer in their own org (BC staff: pass orgId to scope). */
export function listVisibleMaps(
  viewer: Viewer,
  opts: { orgId?: string; kind?: FeltMapRow["kind"] | FeltMapRow["kind"][] } = {}
): Promise<FeltMapRow[]> {
  const kind = opts.kind === undefined ? undefined : Array.isArray(opts.kind) ? { in: opts.kind } : opts.kind;
  // Non-staff are always confined to their own org, whatever orgId is passed.
  const orgId = viewer.role === "BC_STAFF" ? opts.orgId ?? viewer.orgId : viewer.orgId;
  return db.feltMap.findMany({
    where: { AND: [visibleMapsWhere(viewer), { orgId }, kind ? { kind } : {}] },
    orderBy: { title: "asc" },
  });
}

export interface MapAccess {
  map: FeltMapRow;
  canExport: boolean;
}

/**
 * Resolve a Felt map id for a viewer. Returns null if the map isn't registered
 * or the viewer may not see it — callers must treat both as 404 so the
 * existence of other orgs' maps isn't disclosed.
 */
export async function getViewableMap(viewer: Viewer, feltMapId: string): Promise<MapAccess | null> {
  const map = await db.feltMap.findFirst({
    where: { AND: [{ feltMapId }, visibleMapsWhere(viewer)] },
    include: { grants: { where: { userId: viewer.id }, select: { canExport: true } } },
  });
  if (!map) return null;

  const { grants, ...row } = map;
  const canExport = viewer.role === "BC_STAFF" || isOrgAdmin(viewer) || grants.some((g) => g.canExport);
  return { map: row, canExport };
}

export class GrantError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Load a map an org admin (or BC staff) manages access for.
 * Throws GrantError(404) if it's not in the admin's org.
 */
async function getManagedMap(manager: Viewer, mapId: string): Promise<FeltMapRow> {
  if (manager.role !== "BC_STAFF" && !isOrgAdmin(manager)) {
    throw new GrantError("Only organization owners and admins can manage map access", 403);
  }
  const map = await db.feltMap.findUnique({ where: { id: mapId } });
  if (!map || (manager.role !== "BC_STAFF" && map.orgId !== manager.orgId)) {
    throw new GrantError("Map not found", 404);
  }
  return map;
}

export async function setMapVisibility(
  manager: Viewer,
  mapId: string,
  visibility: FeltMapRow["visibility"]
): Promise<void> {
  await getManagedMap(manager, mapId);
  await db.feltMap.update({ where: { id: mapId }, data: { visibility } });
}

/**
 * Grant a member view access to a map. The user must belong to the map's org —
 * this is the cross-org check the schema can't enforce.
 */
export async function grantMapAccess(
  manager: Viewer,
  mapId: string,
  userId: string,
  canExport = false
): Promise<void> {
  const map = await getManagedMap(manager, mapId);
  const user = await db.user.findUnique({ where: { id: userId }, select: { orgId: true } });
  if (!user || user.orgId !== map.orgId) throw new GrantError("User not found", 404);

  await db.feltMapGrant.upsert({
    where: { mapId_userId: { mapId, userId } },
    create: { mapId, userId, canExport, grantedById: manager.id },
    update: { canExport, grantedById: manager.id },
  });
}

export async function revokeMapAccess(manager: Viewer, mapId: string, userId: string): Promise<void> {
  await getManagedMap(manager, mapId);
  await db.feltMapGrant.deleteMany({ where: { mapId, userId } });
}
