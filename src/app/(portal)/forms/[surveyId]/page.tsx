import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getItem } from "@/lib/arcgis/items";
import { classifyFormItem } from "@/lib/arcgis/formKind";
import { getSurveyFields, getSurveyServiceUrl } from "@/lib/arcgis/survey123";
import { getWebMapLayers } from "@/lib/arcgis/featureLayer";
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
  const kind = classifyFormItem(item);

  let serviceUrl = item.url ?? "";
  if (kind === "survey123" && !serviceUrl) {
    serviceUrl = (await getSurveyServiceUrl(surveyId).catch(() => null)) ?? "";
  } else if (kind === "fieldmaps-webmap") {
    const layers = await getWebMapLayers(surveyId).catch(() => []);
    serviceUrl = layers[0]?.url ?? "";
  }

  const fields = serviceUrl ? await getSurveyFields(serviceUrl).catch(() => []) : [];

  return (
    <div className="flex flex-col h-full">
      <TopBar title={item.title} backHref="/forms" backLabel="Forms & Surveys" />
      <div className="flex-1 p-6">
        <FieldEditor
          surveyId={surveyId}
          serviceUrl={serviceUrl}
          initialFields={fields}
          kind={kind}
        />
      </div>
    </div>
  );
}
