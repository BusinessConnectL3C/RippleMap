import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listGroupItems } from "@/lib/arcgis/groups";
import { TopBar } from "@/components/layout/TopBar";
import { FormList } from "@/components/forms/FormList";

export default async function FormsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const groupId = process.env.ARCGIS_GROUP_ID ?? "";

  const [survey123Items, fieldmapsItems] = await Promise.all([
    groupId
      ? listGroupItems(groupId, "Form", 50).catch(() => [])
      : Promise.resolve([]),
    groupId
      ? listGroupItems(groupId, "Feature Service", 50).catch(() => [])
      : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Forms & Data Collection" />
      <div className="flex-1 p-6">
        <FormList survey123Items={survey123Items} fieldmapsItems={fieldmapsItems} />
      </div>
    </div>
  );
}
