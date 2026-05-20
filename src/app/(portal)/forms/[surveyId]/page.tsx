import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getItem } from "@/lib/arcgis/items";
import { getSurveyFields } from "@/lib/arcgis/survey123";
import { TopBar } from "@/components/layout/TopBar";
import { FieldEditor } from "@/components/forms/FieldEditor";

interface Props {
  params: Promise<{ surveyId: string }>;
}

export default async function FormEditorPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { surveyId } = await params;
  const item = await getItem(surveyId);

  const fields = item.url
    ? await getSurveyFields(item.url).catch(() => [])
    : [];

  return (
    <div className="flex flex-col h-full">
      <TopBar title={item.title} />
      <div className="flex-1 p-6">
        <FieldEditor
          surveyId={surveyId}
          serviceUrl={item.url ?? ""}
          initialFields={fields}
          itemType={item.type}
        />
      </div>
    </div>
  );
}
