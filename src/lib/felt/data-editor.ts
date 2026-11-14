import "server-only";
import { createHash } from "node:crypto";
import type { MapUpload } from "@prisma/client";
import { db } from "@/lib/db";
import type { Viewer } from "./access";
import {
  APPENDABLE_EXTENSIONS,
  exportLayer,
  getLayer,
  LAT_COLUMN,
  LON_COLUMN,
  toFieldType,
  typedValue,
  writeLayerData,
  type FieldType,
  type GeoJsonFeature,
} from "./records";
import { authorize, extensionOf, fail, getReplaceableOrigin, listReplaceableLayers, UploadError } from "./uploads";

/**
 * Edit data: change values, delete records and add columns on a layer that
 * came from a portal CSV/GeoJSON upload. Felt's API can't edit single
 * features, so like Add records this exports the layer's current data,
 * applies the changes, and has Felt reload the whole layer.
 *
 * Rows are identified by their position in Felt's export. The editor gets a
 * snapshot hash of the export it was shown; saving re-exports and refuses if
 * the hash changed (someone else saved, or the data was edited in Felt), so
 * positions can't point at the wrong rows and nobody's changes are lost.
 */

export const MAX_EDIT_ROWS = 5000;
const MAX_SAVES_PER_HOUR = 60;

export type EditorType = FieldType;

export interface EditorColumn {
  name: string;
  type: EditorType;
  /** Coordinates come from each record's location and can't be edited here. */
  readOnly: boolean;
}

export interface EditorData {
  columns: EditorColumn[];
  rows: Record<string, unknown>[];
  snapshot: string;
  layerName: string;
}

export interface DataEdits {
  snapshot: string;
  /** Changed cells: row position, column name, new value (string from the editor; "" clears). */
  cells: { row: number; column: string; value: string | boolean | null }[];
  /** Row positions to delete. */
  deleteRows: number[];
  /** New columns, with an optional value for every existing row. */
  addColumns: { name: string; type: "TEXT" | "REAL" | "DATE" | "BOOLEAN"; defaultValue?: string | boolean | null }[];
  confirmed: boolean;
}

function snapshotOf(features: GeoJsonFeature[]): string {
  return createHash("sha256").update(JSON.stringify(features)).digest("hex");
}

async function editableOrigin(viewer: Viewer, feltMapId: string, originUploadId: string) {
  const map = await authorize(viewer, feltMapId);
  const origin = await getReplaceableOrigin(map.id, originUploadId);
  const ext = extensionOf(origin.fileName ?? "");
  if (origin.kind !== "FILE" || !origin.sourceToken || !(APPENDABLE_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new UploadError("Only layers created here from a CSV or GeoJSON upload can be edited.", 400);
  }
  return { map, origin, ext };
}

async function columnsFor(feltMapId: string, origin: MapUpload, features: GeoJsonFeature[]): Promise<EditorColumn[]> {
  const layer = await getLayer(feltMapId, origin.feltLayerId!);
  const columns: EditorColumn[] = (layer.attributes ?? [])
    .map((a) => ({ name: a.name, type: toFieldType(a.type) }))
    .filter((c): c is { name: string; type: FieldType } => c.type !== null)
    .map((c) => ({ ...c, readOnly: LAT_COLUMN.test(c.name) || LON_COLUMN.test(c.name) }));
  // Properties Felt didn't report as attributes are still data: show them as text.
  const known = new Set(columns.map((c) => c.name));
  for (const f of features) {
    for (const key of Object.keys(f.properties ?? {})) {
      if (!known.has(key)) {
        known.add(key);
        columns.push({ name: key, type: "TEXT", readOnly: LAT_COLUMN.test(key) || LON_COLUMN.test(key) });
      }
    }
  }
  return columns;
}

/** Load a layer for editing: its columns, every record's values, and a snapshot to save against. */
export async function loadLayerForEditing(viewer: Viewer, feltMapId: string, originUploadId: string): Promise<EditorData> {
  const { origin } = await editableOrigin(viewer, feltMapId, originUploadId);
  const features = await exportLayer(feltMapId, origin.feltLayerId!);
  if (features.length > MAX_EDIT_ROWS) {
    throw new UploadError(
      `This layer has ${features.length.toLocaleString()} records, more than can be edited here (${MAX_EDIT_ROWS.toLocaleString()}). Use Replace data instead.`,
      413
    );
  }
  return {
    columns: await columnsFor(feltMapId, origin, features),
    rows: features.map((f) => f.properties ?? {}),
    snapshot: snapshotOf(features),
    layerName: origin.layerName,
  };
}

const COLUMN_NAME = /^[\p{L}\p{N}][\p{L}\p{N} _\-().]{0,62}$/u;

/** Apply the editor's changes and have Felt reload the layer. Returns the EDIT upload (IMPORTING). */
export async function saveLayerEdits(
  viewer: Viewer,
  feltMapId: string,
  originUploadId: string,
  edits: DataEdits
): Promise<MapUpload> {
  if (!edits.confirmed) throw new UploadError("Please confirm the data doesn't contain personal or sensitive data", 400);
  if (edits.cells.length === 0 && edits.deleteRows.length === 0 && edits.addColumns.length === 0) {
    throw new UploadError("There are no changes to save.", 400);
  }
  const { map, origin, ext } = await editableOrigin(viewer, feltMapId, originUploadId);

  const recent = await db.mapUpload.count({
    where: { mapId: map.id, mode: "EDIT", createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= MAX_SAVES_PER_HOUR) throw new UploadError("Too many saves on this map in the last hour. Please try again later.", 429);

  const upload = await db.mapUpload.create({
    data: {
      orgId: map.orgId,
      mapId: map.id,
      userId: viewer.id,
      kind: "FILE",
      mode: "EDIT",
      replacesUploadId: origin.id,
      layerName: origin.layerName,
      fileName: origin.fileName,
      confirmedNoSensitiveData: true,
    },
  });

  try {
    const features = await exportLayer(feltMapId, origin.feltLayerId!);
    if (snapshotOf(features) !== edits.snapshot) {
      throw new UploadError(
        "This layer changed since you opened it (someone saved, or it was edited in Felt). Reload the table and make your changes again.",
        409
      );
    }
    const columns = await columnsFor(feltMapId, origin, features);
    const byName = new Map(columns.map((c) => [c.name, c]));

    // New columns: names must be new and readable; values typed per column.
    for (const col of edits.addColumns) {
      const name = col.name.trim();
      if (!COLUMN_NAME.test(name)) throw new UploadError(`"${col.name}" isn't a valid column name.`, 400);
      if (byName.has(name)) throw new UploadError(`There's already a column called "${name}".`, 400);
      const column: EditorColumn = { name, type: col.type, readOnly: false };
      byName.set(name, column);
      columns.push(column);
      const initial = typedValue(col.defaultValue ?? null, col.type);
      for (const f of features) f.properties = { ...(f.properties ?? {}), [name]: initial };
    }

    for (const cell of edits.cells) {
      const column = byName.get(cell.column);
      if (!column) throw new UploadError(`Unknown column "${cell.column}".`, 400);
      if (column.readOnly) throw new UploadError(`"${cell.column}" comes from each record's location and can't be edited here.`, 400);
      const feature = features[cell.row];
      if (!feature) throw new UploadError("A changed record no longer exists. Reload the table.", 409);
      feature.properties = { ...(feature.properties ?? {}), [cell.column]: typedValue(cell.value, column.type) };
    }

    const remove = new Set(edits.deleteRows);
    for (const row of remove) {
      if (!features[row]) throw new UploadError("A deleted record no longer exists. Reload the table.", 409);
    }
    const kept = features.filter((_, i) => !remove.has(i));

    return await writeLayerData(feltMapId, map, origin, upload, kept, columns.map((c) => c.name), ext);
  } catch (err) {
    console.error(`Editing data failed for upload ${upload.id}:`, err);
    const fresh = await db.mapUpload.findUniqueOrThrow({ where: { id: upload.id } });
    const failed = await fail(fresh, err instanceof UploadError ? err.message : "Couldn't save the changes. Please try again.");
    if (err instanceof UploadError && err.status === 409) throw err;
    return failed;
  }
}

/** Layers on this map that can be edited here: portal CSV/GeoJSON uploads still in Felt. */
export async function listEditableLayers(viewer: Viewer, feltMapId: string) {
  const { layers } = await listReplaceableLayers(viewer, feltMapId);
  return layers
    .filter((l) => l.kind === "FILE" && !!l.fileExt && (APPENDABLE_EXTENSIONS as readonly string[]).includes(l.fileExt))
    .map((l) => ({ uploadId: l.uploadId, layerName: l.layerName }));
}
