import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { deleteFile, getObjectSize, getSizedUploadUrl, SYSTEM_BUCKET, SYSTEM_PREFIX } from "@/lib/aws/s3";
import { getViewer, isOrgAdmin, type Viewer } from "@/lib/felt/access";
import { auth } from "@/lib/auth";

/**
 * Organization logos. Stored in RippleMap's system bucket, uploaded straight
 * from the browser with a size-locked presigned PUT, and served only through
 * /api/orgs/[id]/logo. SVG isn't accepted (it can carry scripts).
 */

export const LOGO_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;
export type LogoType = keyof typeof LOGO_TYPES;
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_PREFIX = `${SYSTEM_PREFIX}org-logos/`;

export class LogoError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export async function currentViewer(): Promise<Viewer | null> {
  const session = await auth();
  return session?.user?.id ? getViewer(session.user.id) : null;
}

/** RM Staff for any org; owners and admins for their own. */
export function canManageLogo(viewer: Viewer, orgId: string): boolean {
  return viewer.role === "BC_STAFF" || (viewer.orgId === orgId && isOrgAdmin(viewer));
}

/** Members of the org and RM Staff. */
export function canSeeLogo(viewer: Viewer, orgId: string): boolean {
  return viewer.role === "BC_STAFF" || viewer.orgId === orgId;
}

export function logoContentType(key: string): LogoType {
  const ext = key.split(".").pop();
  const match = Object.entries(LOGO_TYPES).find(([, e]) => e === ext);
  return (match?.[0] as LogoType) ?? "image/png";
}

function isOrgLogoKey(orgId: string, key: string): boolean {
  return key.startsWith(`${LOGO_PREFIX}${orgId}/`) && !key.includes("..");
}

/** Step 1: a presigned PUT for a new logo file. */
export async function startLogoUpload(orgId: string, input: { type: string; sizeBytes: number }) {
  const ext = LOGO_TYPES[input.type as LogoType];
  if (!ext) throw new LogoError("Use a PNG, JPG or WebP image.", 400);
  if (input.sizeBytes <= 0 || input.sizeBytes > MAX_LOGO_BYTES) {
    throw new LogoError("Logos can be up to 2 MB.", 413);
  }
  const key = `${LOGO_PREFIX}${orgId}/${randomBytes(8).toString("hex")}.${ext}`;
  return { key, putUrl: await getSizedUploadUrl(key, input.sizeBytes, SYSTEM_BUCKET) };
}

/** Step 2: the browser finished the PUT; make it the org's logo and remove the old one. */
export async function completeLogoUpload(orgId: string, key: string) {
  if (!isOrgLogoKey(orgId, key)) throw new LogoError("Invalid upload", 400);
  const size = await getObjectSize(key, SYSTEM_BUCKET);
  if (size === null || size > MAX_LOGO_BYTES) throw new LogoError("The logo didn't finish uploading. Try again.", 400);
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { logoKey: true } });
  if (!org) throw new LogoError("Not found", 404);
  await db.organization.update({ where: { id: orgId }, data: { logoKey: key } });
  if (org.logoKey && org.logoKey !== key) {
    await deleteFile(org.logoKey, SYSTEM_BUCKET).catch((err) => console.error(`Couldn't delete old logo ${org.logoKey}:`, err));
  }
}

export async function removeLogo(orgId: string) {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { logoKey: true } });
  if (!org?.logoKey) return;
  await db.organization.update({ where: { id: orgId }, data: { logoKey: null } });
  await deleteFile(org.logoKey, SYSTEM_BUCKET).catch((err) => console.error(`Couldn't delete logo ${org.logoKey}:`, err));
}

/** URL the portal uses for an org's logo (changes when the logo does, so browsers refetch). */
export function orgLogoUrl(orgId: string, logoKey: string | null | undefined): string | null {
  if (!logoKey) return null;
  const version = logoKey.split("/").pop()?.split(".")[0] ?? "";
  return `/api/orgs/${orgId}/logo?v=${version}`;
}
