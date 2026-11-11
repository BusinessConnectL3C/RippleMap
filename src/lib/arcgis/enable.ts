import "server-only";
import { db } from "@/lib/db";
import { createClientGroup } from "./groups";

/**
 * Turn ArcGIS features on for an org and make sure it has its private ArcGIS
 * group. ArcGIS is opt-in (Felt is the default), so the group is created here —
 * when an org first connects ArcGIS or BC staff enable it — rather than at
 * registration. Group creation is best-effort: on failure ArcGIS is still
 * enabled and BC staff can set the group id from the admin org page.
 */
export async function enableArcgisForOrg(orgId: string): Promise<string | null> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { name: true, arcgisGroupId: true, arcgisEnabled: true },
  });
  if (!org) return null;

  let groupId = org.arcgisGroupId;
  if (!groupId) {
    try {
      groupId = await createClientGroup(org.name);
    } catch (err) {
      console.error(`Failed to create ArcGIS group for org ${orgId}:`, err);
    }
  }

  if (!org.arcgisEnabled || groupId !== org.arcgisGroupId) {
    await db.organization.update({
      where: { id: orgId },
      data: { arcgisEnabled: true, arcgisGroupId: groupId },
    });
  }
  return groupId;
}
