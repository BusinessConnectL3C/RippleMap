import type { ArcGISItem, FormKind } from "@/types/arcgis";

const SURVEY123_KEYWORDS = ["Survey123", "Survey123 Connect"];

function hasSurvey123Keyword(item: ArcGISItem): boolean {
  return (item.typeKeywords ?? []).some((k) => SURVEY123_KEYWORDS.includes(k));
}

/**
 * Classify an ArcGIS item as a Survey123 form or a Field Maps form.
 * Field Maps has no item type of its own — it's either a Web Map (form config
 * lives per-layer inside the map JSON) or a bare hosted Feature Service. Survey123
 * is a "Form" item carrying a Survey123 typeKeyword; the Feature Service backing it
 * is a separate related item and is excluded here so it isn't listed twice.
 *
 * Pure and dependency-free so it can be imported from client components —
 * keep it that way; put anything that fetches from ArcGIS elsewhere.
 */
export function classifyFormItem(item: ArcGISItem): FormKind {
  if (item.type === "Form" && hasSurvey123Keyword(item)) return "survey123";
  if (item.type === "Web Map") return "fieldmaps-webmap";
  if (item.type === "Feature Service" && !hasSurvey123Keyword(item)) return "fieldmaps-layer";
  return "unknown";
}
