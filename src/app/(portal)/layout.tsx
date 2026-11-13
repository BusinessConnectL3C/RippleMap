import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Sidebar, SIDEBAR_COOKIE } from "@/components/layout/Sidebar";
import { MobileNavProvider } from "@/components/layout/MobileNavContext";
import { orgLogoUrl } from "@/lib/org-logo";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const su = session.user as unknown as { orgId: string };
  const [state, org, user] = await Promise.all([
    db.onboardingState.findUnique({
      where: { orgId: su.orgId },
      select: { completed: true },
    }),
    db.organization.findUnique({
      where: { id: su.orgId },
      select: { name: true, mediaSource: true, logoKey: true },
    }),
    db.user.findUnique({ where: { id: session.user.id }, select: { role: true, emailVerifiedAt: true } }),
  ]);

  if (!user?.emailVerifiedAt) redirect("/verify-email");
  if (!state?.completed) redirect("/onboarding");

  const showMedia = !!org?.mediaSource;
  const sidebarCollapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";

  return (
    <MobileNavProvider>
      <div className="flex h-full">
        <Sidebar
          showMedia={showMedia} orgName={org?.name} isStaff={user?.role === "BC_STAFF"}
          defaultCollapsed={sidebarCollapsed}
          orgLogoUrl={orgLogoUrl(su.orgId, org?.logoKey)}
        />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </MobileNavProvider>
  );
}
