import "server-only";
import { db } from "@/lib/db";

/**
 * Plan tiers, derived from the org's staff-managed billing record:
 *   no record, FREE, CANCELED → free
 *   TRIAL                    → trial
 *   ACTIVE, PAST_DUE         → paid (past-due keeps paid access as a grace period)
 */
export type PlanTier = "free" | "trial" | "paid";

export interface UploadLimits {
  /** Largest file accepted from the portal, in bytes. */
  maxFileBytes: number;
  /** Uploads (files + links) per map; null = unlimited. */
  maxUploadsPerMap: number | null;
}

const MB = 1024 * 1024;
const GB = 1024 * MB;

export const UPLOAD_LIMITS: Record<PlanTier, UploadLimits> = {
  free: { maxFileBytes: 10 * MB, maxUploadsPerMap: 3 },
  trial: { maxFileBytes: 50 * MB, maxUploadsPerMap: 10 },
  // Felt accepts up to 100 GB per file, but a single S3 PUT tops out at 5 GB.
  // Larger data should be connected as a source by BC instead.
  paid: { maxFileBytes: 5 * GB, maxUploadsPerMap: null },
};

export const PLAN_LABEL: Record<PlanTier, string> = { free: "Free", trial: "Trial", paid: "Paid" };

export async function getOrgTier(orgId: string): Promise<PlanTier> {
  const billing = await db.orgBilling.findUnique({ where: { orgId }, select: { status: true } });
  switch (billing?.status) {
    case "TRIAL":
      return "trial";
    case "ACTIVE":
    case "PAST_DUE":
      return "paid";
    default:
      return "free";
  }
}

export function formatBytes(bytes: number): string {
  if (bytes >= GB) return `${Math.round(bytes / GB)} GB`;
  return `${Math.round(bytes / MB)} MB`;
}
