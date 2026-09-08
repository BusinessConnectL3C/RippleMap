import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { listGroupItems } from "@/lib/arcgis/groups";
import { classifyFormItem } from "@/lib/arcgis/formKind";
import { TopBar } from "@/components/layout/TopBar";
import { FormList } from "@/components/forms/FormList";

export default async function FormsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const su = session.user as unknown as { orgId: string };
  const org = await db.organization.findUnique({
    where: { id: su.orgId },
    select: { arcgisGroupId: true },
  });

  const [surveyForms, webMaps, featureServices] = org?.arcgisGroupId
    ? await Promise.all([
        listGroupItems(org.arcgisGroupId, "Form", 50).catch(() => []),
        listGroupItems(org.arcgisGroupId, "Web Map", 50).catch(() => []),
        listGroupItems(org.arcgisGroupId, "Feature Service", 50).catch(() => []),
      ])
    : [[], [], []];

  // Excludes items classifyFormItem can't place — e.g. a Survey123 Form's own
  // backing Feature Service, which would otherwise show up as a duplicate row.
  const items = [...surveyForms, ...webMaps, ...featureServices]
    .filter((item) => classifyFormItem(item) !== "unknown")
    .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Forms & Surveys" />
      <div className="flex-1 p-6">
        <FormList items={items} />
      </div>
    </div>
  );
}
