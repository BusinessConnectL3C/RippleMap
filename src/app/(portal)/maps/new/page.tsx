import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getViewer, isOrgAdmin } from "@/lib/felt/access";
import { listTemplates } from "@/lib/felt/templates";
import { TopBar } from "@/components/layout/TopBar";
import { TemplatePicker } from "@/components/maps/TemplatePicker";

export default async function NewMapPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const viewer = await getViewer(session.user.id);
  if (!viewer) redirect("/login");
  if (viewer.role !== "BC_STAFF" && !isOrgAdmin(viewer)) redirect("/maps");

  const [templates, org] = await Promise.all([
    listTemplates(),
    db.organization.findUnique({ where: { id: viewer.orgId }, select: { feltProjectId: true } }),
  ]);

  return (
    <div className="flex flex-col h-full">
      <TopBar title="New map" backHref="/maps" backLabel="Maps & Apps" />
      <div className="flex-1 p-6">
        {!org?.feltProjectId ? (
          <p className="text-sm text-text-secondary">
            Your map workspace is still being set up. Check back shortly, or contact support if this persists.
          </p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-text-secondary">No templates are available yet. Contact support to request a map.</p>
        ) : (
          <TemplatePicker
            templates={templates.map((t) => ({
              id: t.id,
              title: t.title,
              description: t.templateDescription,
              kind: t.kind,
              thumbnailUrl: t.thumbnailKey ? `/api/felt/templates/${t.id}/thumbnail?v=${t.updatedAt.getTime()}` : null,
            }))}
          />
        )}
      </div>
    </div>
  );
}
