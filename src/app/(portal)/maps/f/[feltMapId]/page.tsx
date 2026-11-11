import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getViewer, getViewableMap, isOrgAdmin } from "@/lib/felt/access";
import { isValidFeltId } from "@/lib/felt/maps";
import { TopBar } from "@/components/layout/TopBar";
import { FeltMapEmbed } from "@/components/maps/FeltMapEmbed";

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

  return (
    <div className="flex flex-col h-full">
      <TopBar title={access.map.title} backHref="/maps" backLabel="Maps & Apps" />
      <div className="flex-1 p-0 overflow-hidden">
        <FeltMapEmbed
          feltMapId={access.map.feltMapId}
          title={access.map.title}
          canSetThumbnail={viewer.role === "BC_STAFF" || isOrgAdmin(viewer)}
        />
      </div>
    </div>
  );
}
