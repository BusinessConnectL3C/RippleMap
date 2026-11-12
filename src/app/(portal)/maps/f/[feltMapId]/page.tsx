import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getViewer, getViewableMap, isOrgAdmin } from "@/lib/felt/access";
import { getMap, isValidFeltId } from "@/lib/felt/maps";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/layout/TopBar";
import { FeltMapEmbed } from "@/components/maps/FeltMapEmbed";
import { AddDataPanel } from "@/components/maps/AddDataPanel";
import { db } from "@/lib/db";
import { PLAN_LABEL } from "@/lib/plans";
import { ALLOWED_EXTENSIONS, getUploadQuota, serializeUpload } from "@/lib/felt/uploads";

interface Props {
  params: Promise<{ feltMapId: string }>;
}

export default async function FeltMapPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { feltMapId } = await params;
  if (!isValidFeltId(feltMapId)) notFound();

  const viewer = await getViewer(session.user.id);
  if (!viewer) redirect("/login");

  // Same check the embed-token route makes; doing it here too means a user
  // without access gets a 404 page instead of an empty map frame.
  const access = await getViewableMap(viewer, feltMapId);
  if (!access) notFound();

  const canManage = viewer.role === "BC_STAFF" || isOrgAdmin(viewer);

  // Field Editors (Felt seat holders) are invited to the org's Felt project,
  // so they can open the map in Felt to edit it. Nobody else has a Felt
  // account that can open a private map, so they don't get the link.
  const user = await db.user.findUnique({ where: { id: viewer.id }, select: { feltSeat: true } });
  const feltUrl = user?.feltSeat
    ? await getMap(feltMapId)
        .then((m) => m.url)
        .catch(() => `https://felt.com/map/${feltMapId}`)
    : null;
  const [quota, recent] = canManage
    ? await Promise.all([
        getUploadQuota(access.map.orgId, access.map.id),
        db.mapUpload.findMany({ where: { mapId: access.map.id }, orderBy: { createdAt: "desc" }, take: 5 }),
      ])
    : [null, []];

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title={access.map.title}
        backHref="/maps"
        backLabel="Maps & Apps"
        actions={
          feltUrl && (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a
                href={feltUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Edit this map in Felt. Sign in to Felt with your Field Editor account."
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open in Felt
              </a>
            </Button>
          )
        }
      />
      {quota && (
        <AddDataPanel
          feltMapId={access.map.feltMapId}
          planLabel={PLAN_LABEL[quota.tier]}
          maxFileBytes={quota.maxFileBytes}
          maxUploadsPerMap={quota.maxUploadsPerMap}
          used={quota.used}
          recent={recent.map(serializeUpload)}
          accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",")}
        />
      )}
      <div className="flex-1 p-0 overflow-hidden">
        <FeltMapEmbed
          feltMapId={access.map.feltMapId}
          title={access.map.title}
          canSetThumbnail={canManage}
        />
      </div>
    </div>
  );
}
