import "server-only";
import { db } from "@/lib/db";

/**
 * Felt seat bookkeeping. Felt has no members API, so these numbers come from
 * what BC staff record in RippleMap (User.feltSeat), not from Felt itself.
 * FELT_SEAT_LIMIT is the workspace's purchased seats (default 10).
 */
export function feltSeatLimit(): number {
  const n = Number(process.env.FELT_SEAT_LIMIT);
  return Number.isInteger(n) && n > 0 ? n : 10;
}

export async function feltSeatUsage(): Promise<{ used: number; limit: number }> {
  const used = await db.user.count({ where: { feltSeat: true } });
  return { used, limit: feltSeatLimit() };
}
