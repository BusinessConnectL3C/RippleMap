import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getProject } from "./projects";
import { deleteMap, isPublicInFelt, lockDownMap, TEMP_PRINT_MAP_TITLE } from "./maps";
import type { FeltMapReference } from "./types";

/**
 * Bring RippleMap's map registry for one org in line with its Felt project.
 *
 * Felt has no "map added to project" webhook, so this runs when it matters:
 * when BC staff press Sync, when an org owner/admin presses "Check Felt for new
 * maps", and automatically (throttled) when an owner/admin opens Maps & Apps or
 * Map Access. One Felt API read per run; no Felt AI credits, no map views.
 *
 * Rules:
 * - New private map  → registered RESTRICTED; viewer export/duplication off.
 * - New public map   → registered PUBLIC and flagged madePublicInFelt. The
 *   public link keeps working (BC decision, 2026-11-11); admins see the flag.
 * - Registered map made public in Felt later → PUBLIC + flagged, same reason.
 * - Registered PUBLIC map made private in Felt → back to RESTRICTED (the safe
 *   default; admins can widen it again).
 * - Titles follow Felt.
 * - A map registered to a different org is reported, never moved.
 */

/** Minimum gap between automatic checks for one org. */
const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

export interface SyncResult {
  added: string[]; // FeltMap row ids, for thumbnail generation
  madePublic: number;
  madePrivate: number;
  conflicts: string[]; // Felt map ids registered to another org
}

export class SyncError extends Error {}

export async function syncOrgMaps(orgId: string): Promise<SyncResult> {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { feltProjectId: true } });
  if (!org?.feltProjectId) throw new SyncError("This organization has no Felt project yet.");

  const project = await getProject(org.feltProjectId);
  const refs = project.maps;
  const registered = await db.feltMap.findMany({
    where: { feltMapId: { in: refs.map((m) => m.id) } },
    select: { id: true, feltMapId: true, orgId: true, visibility: true, title: true },
  });
  const byFeltId = new Map(registered.map((r) => [r.feltMapId, r]));

  const result: SyncResult = { added: [], madePublic: 0, madePrivate: 0, conflicts: [] };

  for (const ref of refs) {
    // Temporary copies made for filtered prints are never portal maps. One
    // left behind by a crashed print (normally deleted within ~2 min) is
    // cleaned up here.
    if (ref.title === TEMP_PRINT_MAP_TITLE) {
      const age = Date.now() - Date.parse(ref.created_at);
      if (age > 15 * 60 * 1000) {
        await deleteMap(ref.id).catch((err) => console.error(`Couldn't delete leftover print copy ${ref.id}:`, err));
      }
      continue;
    }
    const row = byFeltId.get(ref.id);
    if (row && row.orgId !== orgId) {
      result.conflicts.push(ref.id);
      continue;
    }
    if (!row) {
      const id = await registerFromRef(orgId, ref);
      if (id) {
        result.added.push(id);
        if (isPublicInFelt(ref)) result.madePublic++;
      }
      continue;
    }

    const publicInFelt = isPublicInFelt(ref);
    if (publicInFelt && row.visibility !== "PUBLIC") {
      await db.feltMap.update({
        where: { id: row.id },
        data: { visibility: "PUBLIC", madePublicInFelt: true, publicSince: new Date(), title: ref.title },
      });
      result.madePublic++;
    } else if (!publicInFelt && row.visibility === "PUBLIC") {
      await db.feltMap.update({
        where: { id: row.id },
        data: { visibility: "RESTRICTED", madePublicInFelt: false, publicSince: null, title: ref.title },
      });
      result.madePrivate++;
    } else if (row.title !== ref.title) {
      await db.feltMap.update({ where: { id: row.id }, data: { title: ref.title } });
    }
  }

  await db.organization.update({ where: { id: orgId }, data: { feltSyncedAt: new Date() } });
  return result;
}

/**
 * Register one map found in an org's project. Returns the new row id, or null
 * if another request registered it first (unique feltMapId).
 */
async function registerFromRef(orgId: string, ref: FeltMapReference): Promise<string | null> {
  const isPublic = isPublicInFelt(ref);
  try {
    const row = await db.feltMap.create({
      data: {
        orgId,
        feltMapId: ref.id,
        title: ref.title,
        kind: "MAP",
        visibility: isPublic ? "PUBLIC" : "RESTRICTED",
        madePublicInFelt: isPublic,
        publicSince: isPublic ? new Date() : null,
      },
    });
    // Private maps get viewer export/duplication switched off. Public-in-Felt
    // maps are left exactly as their editor set them (flagged for review).
    if (!isPublic) await lockDownMap(ref.id);
    return row.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return null;
    throw err;
  }
}

/**
 * Throttled sync for page loads: runs only if the org has a Felt project and
 * wasn't checked in the last few minutes. Never throws — a Felt hiccup must
 * not break the page.
 */
export async function autoSyncOrgMaps(orgId: string): Promise<SyncResult | null> {
  try {
    const cutoff = new Date(Date.now() - AUTO_SYNC_INTERVAL_MS);
    // Claim the slot atomically so two admins loading at once don't both sync.
    const claimed = await db.organization.updateMany({
      where: {
        id: orgId,
        feltProjectId: { not: null },
        OR: [{ feltSyncedAt: null }, { feltSyncedAt: { lt: cutoff } }],
      },
      data: { feltSyncedAt: new Date() },
    });
    if (claimed.count === 0) return null;
    return await syncOrgMaps(orgId);
  } catch (err) {
    console.error(`Automatic Felt sync failed for org ${orgId}:`, err);
    return null;
  }
}
