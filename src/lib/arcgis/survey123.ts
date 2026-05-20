import type {
  FeatureServiceDefinition,
  FeatureServiceField,
} from "@/types/arcgis";
import { getBCAppToken } from "./auth";

/**
 * Fetch the field definitions from a Survey123-backed Feature Service.
 * The serviceUrl should be the full REST endpoint (without /0).
 */
export async function getSurveyFields(
  serviceUrl: string
): Promise<FeatureServiceField[]> {
  const token = await getBCAppToken();
  const res = await fetch(`${serviceUrl}/0?f=json&token=${token}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch feature service: ${res.statusText}`);
  }
  const data: FeatureServiceDefinition = await res.json();
  return data.fields ?? [];
}

/**
 * Add a new field to a Survey123-backed Feature Service.
 * Safe operation — only additive; will not modify existing fields.
 */
export async function addSurveyField(
  serviceUrl: string,
  field: FeatureServiceField
): Promise<void> {
  const token = await getBCAppToken();
  const params = new URLSearchParams({
    addToDefinition: JSON.stringify({ fields: [field] }),
    token,
    f: "json",
  });

  const res = await fetch(`${serviceUrl}/0/addToDefinition`, {
    method: "POST",
    body: params,
  });
  if (!res.ok) throw new Error(`Failed to add field: ${res.statusText}`);

  const data = await res.json();
  if (data.error) {
    throw new Error(`ArcGIS error: ${data.error.message}`);
  }
}

/**
 * Update an existing field's alias or domain (coded-value options).
 * Only safe changes are exposed — no type changes.
 */
export async function updateSurveyField(
  serviceUrl: string,
  field: FeatureServiceField
): Promise<void> {
  const token = await getBCAppToken();
  const params = new URLSearchParams({
    updateDefinition: JSON.stringify({ fields: [field] }),
    token,
    f: "json",
  });

  const res = await fetch(`${serviceUrl}/0/updateDefinition`, {
    method: "POST",
    body: params,
  });
  if (!res.ok) throw new Error(`Failed to update field: ${res.statusText}`);

  const data = await res.json();
  if (data.error) {
    throw new Error(`ArcGIS error: ${data.error.message}`);
  }
}
