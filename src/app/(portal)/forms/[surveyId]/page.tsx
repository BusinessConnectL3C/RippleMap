import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getOrgItem } from "@/lib/arcgis/access";
import { classifyFormItem } from "@/lib/arcgis/formKind";
import { getSurveyFields, resolveFormServiceUrl } from "@/lib/arcgis/survey123";
import { TopBar } from "@/components/layout/TopBar";
import { FieldEditor } from "@/components/forms/FieldEditor";

interface Props {
  params: Promise<{ surveyId: string }>;
}

export default async function FormEditorPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { surveyId } = await params;
  const su = session.user as unknown as { orgId: string };
  const item = await getOrgItem(su.orgId, surveyId);
  if (!item) notFound();

  const kind = classifyFormItem(item);
  const serviceUrl = (await resolveFormServiceUrl(item)) ?? "";

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
