import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const su = session.user as unknown as { orgId: string };
  const state = await db.onboardingState.findUnique({
    where: { orgId: su.orgId },
    select: { completed: true },
  });

  if (!state?.completed) redirect("/onboarding");

  const showMedia = su.orgId === process.env.GOOD_JUSTICE_ORG_ID;

  return (
    <div className="flex h-full">
      <Sidebar showMedia={showMedia} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
