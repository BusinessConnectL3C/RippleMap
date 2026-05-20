import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getItem } from "@/lib/arcgis/items";
import { getSurveyFields, addSurveyField, updateSurveyField } from "@/lib/arcgis/survey123";
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

const addFieldSchema = z.object({
  action: z.literal("addField"),
  field: fieldSchema,
  serviceUrl: z.string().url(),
});

const updateFieldSchema = z.object({
  action: z.literal("updateField"),
  field: fieldSchema,
  serviceUrl: z.string().url(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ surveyId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { surveyId } = await params;
  const item = await getItem(surveyId);
  if (!item.url) {
    return NextResponse.json({ error: "Feature service URL not found" }, { status: 404 });
  }

  const fields = await getSurveyFields(item.url);
  return NextResponse.json({ fields, serviceUrl: item.url });
}

export async function POST(
  req: NextRequest,
  { params: _params }: { params: Promise<{ surveyId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  if (body.action === "addField") {
    const parsed = addFieldSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid field definition" }, { status: 400 });
    }
    await addSurveyField(parsed.data.serviceUrl, parsed.data.field);
    return NextResponse.json({ success: true });
  }

  if (body.action === "updateField") {
    const parsed = updateFieldSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid field definition" }, { status: 400 });
    }
    await updateSurveyField(parsed.data.serviceUrl, parsed.data.field);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
