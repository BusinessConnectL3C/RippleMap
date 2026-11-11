import "server-only";
import { auth } from "@/lib/auth";
import { getViewer, type Viewer } from "@/lib/felt/access";

/**
 * Resolve the signed-in user and require BC_STAFF, re-reading the role from the
 * database (not the JWT) so a demoted account loses admin access immediately.
 */
export async function requireStaffViewer(): Promise<Viewer | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const viewer = await getViewer(session.user.id);
  return viewer?.role === "BC_STAFF" ? viewer : null;
}
