import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * BC staff don't file tickets against their own (internal) org; they work
 * every org's tickets in the admin portal, so send them there.
 */
export default async function SupportLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role === "BC_STAFF") redirect("/admin/tickets");

  return children;
}
