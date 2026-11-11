import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgItem } from "@/lib/arcgis/access";
import {
  getSurveyFields,
  resolveFormServiceUrl,
  addSurveyField,
  updateSurveyField,
} from "@/lib/arcgis/survey123";
import { z } from "zod";

const fieldSchema = z.object({
  name: z.string(),
  type: z.enum(["esriFieldTypeString", "esriFieldTypeInteger", "esriFieldTypeDouble", "esriFieldTypeDate"]),
  alias: z.string(),
  nullable: z.boolean().optional(),
  length: z.number().optional(),
  domain: z.object({
    type: z.literal("codedValue"),
    name: z.string(),
    codedValues: z.array(z.object({ name: z.string(), code: z.union([z.string(), z.number()]) })),
  }).nullable().optional(),
});

// No serviceUrl in the body: the service is always resolved server-side from an
// item verified to belong to the caller's org (see resolveFormServiceUrl).
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("addField"), field: fieldSchema }),
  z.object({ action: z.literal("updateField"), field: fieldSchema }),
]);

async function resolveOrgFormService(orgId: string, surveyId: string) {
  const item = await getOrgItem(orgId, surveyId);
  if (!item) return null;
  return resolveFormServiceUrl(item);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ surveyId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { surveyId } = await params;
  const su = session.user as unknown as { orgId: string };
  const serviceUrl = await resolveOrgFormService(su.orgId, surveyId);

  if (!serviceUrl) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  const fields = await getSurveyFields(serviceUrl);
  return NextResponse.json({ fields, serviceUrl });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ surveyId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid field definition" }, { status: 400 });
  }

  const { surveyId } = await params;
  const su = session.user as unknown as { orgId: string };
  const serviceUrl = await resolveOrgFormService(su.orgId, surveyId);
  if (!serviceUrl) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  if (parsed.data.action === "addField") {
    await addSurveyField(serviceUrl, parsed.data.field);
  } else {
    await updateSurveyField(serviceUrl, parsed.data.field);
  }
  return NextResponse.json({ success: true });
}
