import ExcelJS from "exceljs";
import type { FeatureServiceField } from "@/types/arcgis";

function isDateField(field: FeatureServiceField): boolean {
  return field.type === "esriFieldTypeDate";
}

function formatDisplayValue(value: unknown, field: FeatureServiceField): string {
  if (value === null || value === undefined) return "";
  if (isDateField(field) && typeof value === "number") {
    return new Date(value).toISOString();
  }
  return String(value);
}

function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Serialize records to CSV, using field aliases as human-readable headers. */
export function toCSV(
  records: Record<string, unknown>[],
  fields: FeatureServiceField[]
): string {
  const header = fields.map((f) => csvEscape(f.alias || f.name));
  const rows = records.map((record) =>
    fields.map((f) => csvEscape(formatDisplayValue(record[f.name], f))).join(",")
  );

  return [header.join(","), ...rows].join("\r\n");
}

/** Serialize records to JSON, keyed by raw field name with ISO dates. */
export function toJSONRecords(
  records: Record<string, unknown>[],
  fields: FeatureServiceField[]
): Record<string, unknown>[] {
  const dateFieldNames = new Set(fields.filter(isDateField).map((f) => f.name));

  return records.map((record) => {
    const out: Record<string, unknown> = {};
    for (const field of fields) {
      const value = record[field.name];
      out[field.name] =
        dateFieldNames.has(field.name) && typeof value === "number"
          ? new Date(value).toISOString()
          : (value ?? null);
    }
    return out;
  });
}

/** Serialize records to an XLSX workbook buffer, using field aliases as column headers. */
export async function toXLSX(
  records: Record<string, unknown>[],
  fields: FeatureServiceField[],
  sheetTitle: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheetName = (sheetTitle || "Data").replace(/[[\]*/\\?:]/g, " ").slice(0, 31) || "Data";
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = fields.map((f) => ({ header: f.alias || f.name, key: f.name, width: 20 }));

  for (const record of records) {
    const row: Record<string, unknown> = {};
    for (const field of fields) {
      const value = record[field.name];
      row[field.name] =
        isDateField(field) && typeof value === "number" ? new Date(value) : (value ?? null);
    }
    sheet.addRow(row);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
