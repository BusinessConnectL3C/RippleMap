import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { feltFetch } from "./client";
import { getViewableMap, type Viewer } from "./access";
import { deleteMap, duplicateMapIntoProject, getMap, TEMP_PRINT_MAP_TITLE } from "./maps";

/**
 * Printing from the portal, through Felt's print editor API.
 *
 * - Layouts: Felt's built-in layouts plus BC's own workspace layouts, named
 *   "RippleMap …". Other workspace layouts are hidden: the Felt workspace is
 *   shared by every client org, so a layout a client's Field Editor saved
 *   (with its text) must never be offered to another org.
 *   A print creates a temporary page on the map from the layout, exports it,
 *   and deletes the page again.
 * - Pages: print pages already designed on this map in Felt are exported as
 *   they are.
 *
 * Anyone who can view a map can print it (BC decision): a print shows what
 * they can already see.
 */

export class PrintError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const BC_LAYOUT_PREFIX = /^ripplemap\b/i;
const TEMP_PAGE_NAME = "RippleMap portal print (temporary)";

interface FeltPrintLayout {
  id: string;
  name: string;
  kind: "built_in" | "workspace";
  orientation: "portrait" | "landscape" | null;
  contents?: unknown;
}

interface FeltPageItem {
  id: string;
  type: "map" | "locator" | "legend" | "text" | "image" | "section";
  frame: { x: number; y: number; width: number; height: number };
  z_index: number;
  background_color?: string | null;
  font_size_pt?: number;
  font_weight?: number;
  align?: "left" | "center" | "right";
  text?: string;
}

interface FeltPageDetail {
  id: string;
  page: { width: number; height: number; units: "in" | "cm" | "mm" | "px"; orientation: "portrait" | "landscape" };
  items: FeltPageItem[];
}

interface FeltPrintPage {
  id: string;
  name: string | null;
  page: { size: string; orientation: "portrait" | "landscape" };
  output: { format: "png" | "jpg" | "pdf" | "svg" };
}

interface FeltPrintExport {
  download_url: string;
  filename: string;
}

export interface PrintLayoutOption {
  id: string;
  name: string;
  /** BC's own (RippleMap-branded) layout rather than one of Felt's built-ins. */
  branded: boolean;
  orientation: "portrait" | "landscape" | null;
  /** Assigned to this org by BC staff (not offered to other orgs). */
  assigned: boolean;
  /** This org's preselected layout. */
  isDefault: boolean;
}

/** One item of a layout wireframe, in fractions of the page (0–1). */
export interface PreviewItem {
  type: FeltPageItem["type"];
  x: number;
  y: number;
  w: number;
  h: number;
  /** Text size as a fraction of the page height (text and legends). */
  size?: number;
  bold?: boolean;
  align?: "left" | "center" | "right";
  fill?: string | null;
}

export interface LayoutPreview {
  layoutId: string;
  orientation: "portrait" | "landscape";
  /** width / height of the page. */
  aspect: number;
  items: PreviewItem[];
}

export interface PrintPageOption {
  id: string;
  name: string;
  size: string;
  orientation: "portrait" | "landscape";
  format: string;
}

export const PAPER_SIZES = ["letter", "tabloid", "a4", "a3"] as const;
export const PRINT_FORMATS = ["pdf", "png", "jpg"] as const;
export const PRINT_DPI = [150, 300] as const;

export interface PrintRequest {
  layoutId: string;
  size: (typeof PAPER_SIZES)[number];
  orientation: "portrait" | "landscape";
  format: (typeof PRINT_FORMATS)[number];
  dpi: (typeof PRINT_DPI)[number];
  /** [west, south, east, north] of the viewer's current view; omit for the map's saved view. */
  bounds?: [number, number, number, number];
  /**
   * Layers visible in the viewer. Felt's print API can't take filters, but it
   * can set which layers each map on the page shows. Omit for the saved set.
   */
  layerIds?: string[];
  /**
   * The viewer's filters per layer (Felt Style Language, the SDK's `combined`
   * filters), for layers where they differ from the saved style. Felt's print
   * API can't take filters, so these are printed from a temporary copy of the
   * map with the filters saved into its layer styles.
   */
  filters?: { layerId: string; filters: unknown }[];
  /** Replaces `{{ map.title }}` in the layout's text. Default: the map's title. */
  title?: string;
  /** The print page's name, which Felt uses for the downloaded file. Default: the title. */
  fileName?: string;
}

const MAP_TITLE_TOKEN = /\{\{\s*map\.title\s*\}\}/;
const MAP_TITLE_TOKENS = /\{\{\s*map\.title\s*\}\}/g;

/** Text for a print: no Liquid syntax (it would be evaluated), no control characters. */
function cleanPrintText(text: string, max: number): string {
  return text
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\{[{%]|[%}]\}/g, "")
    .trim()
    .slice(0, max);
}

async function authorize(viewer: Viewer, feltMapId: string) {
  const access = await getViewableMap(viewer, feltMapId);
  if (!access) throw new PrintError("Map not found", 404);
  return access.map;
}

const path = (feltMapId: string) => `/maps/${encodeURIComponent(feltMapId)}`;

function fetchLayouts(feltMapId: string) {
  return feltFetch<FeltPrintLayout[]>(`${path(feltMapId)}/print_layouts`);
}

/**
 * Layouts an org may print with: Felt's built-ins, BC's shared "RippleMap …"
 * layouts, and workspace layouts BC staff assigned to this org. Order: the
 * org's default, its assigned layouts, shared RippleMap ones, then built-ins.
 */
async function allowedLayouts(feltMapId: string, orgId: string): Promise<PrintLayoutOption[]> {
  const [layouts, assignments] = await Promise.all([
    fetchLayouts(feltMapId),
    db.orgPrintLayout.findMany({ where: { orgId }, select: { feltLayoutId: true, isDefault: true } }),
  ]);
  const assigned = new Map(assignments.map((a) => [a.feltLayoutId, a.isDefault]));
  const rank = (l: PrintLayoutOption) => (l.isDefault ? 0 : l.assigned ? 1 : l.branded ? 2 : 3);
  return layouts
    .filter((l) => l.kind === "built_in" || BC_LAYOUT_PREFIX.test(l.name) || assigned.has(l.id))
    .map((l) => ({
      id: l.id,
      name: l.name,
      branded: l.kind === "workspace",
      orientation: l.orientation,
      // A built-in or shared layout can have a row only as the org's default.
      assigned: assigned.has(l.id) && l.kind === "workspace" && !BC_LAYOUT_PREFIX.test(l.name),
      isDefault: assigned.get(l.id) === true,
    }))
    .sort((a, b) => rank(a) - rank(b));
}

export interface AdminLayoutOption {
  id: string;
  name: string;
  kind: "built_in" | "workspace";
  orientation: "portrait" | "landscape" | null;
  /** Offered to every org by name ("RippleMap …"). */
  shared: boolean;
}

/** Every layout in BC's Felt workspace, for staff assigning layouts to orgs. */
export async function listWorkspaceLayouts(feltMapId: string): Promise<AdminLayoutOption[]> {
  const layouts = await fetchLayouts(feltMapId);
  return layouts.map((l) => ({
    id: l.id,
    name: l.name,
    kind: l.kind,
    orientation: l.orientation,
    shared: l.kind === "built_in" || BC_LAYOUT_PREFIX.test(l.name),
  }));
}

const UNIT_INCHES = { in: 1, cm: 1 / 2.54, mm: 1 / 25.4, px: 1 / 96 } as const;

/** Build a layout's wireframe: make a page from it, read the item frames, delete the page. */
async function buildPreview(
  feltMapId: string,
  layout: FeltPrintLayout,
  orientation: "portrait" | "landscape"
): Promise<LayoutPreview> {
  const page = await feltFetch<FeltPageDetail>(`${path(feltMapId)}/print_pages`, {
    method: "POST",
    body: { name: TEMP_PAGE_NAME, layout_id: layout.id, page: { size: "letter", orientation } },
  });
  try {
    const { width, height, units } = page.page;
    const heightIn = height * UNIT_INCHES[units];
    const items = [...page.items]
      .sort((a, b) => a.z_index - b.z_index)
      .map((it): PreviewItem => ({
        type: it.type,
        x: it.frame.x / width,
        y: it.frame.y / height,
        w: it.frame.width / width,
        h: it.frame.height / height,
        ...(it.font_size_pt && { size: it.font_size_pt / 72 / heightIn }),
        ...(it.font_weight === 700 && { bold: true }),
        ...(it.align && { align: it.align }),
        ...(it.background_color !== undefined && { fill: it.background_color }),
      }));
    return { layoutId: layout.id, orientation, aspect: width / height, items };
  } finally {
    await feltFetch(`${path(feltMapId)}/print_pages/${encodeURIComponent(page.id)}`, { method: "DELETE" }).catch((err) =>
      console.error(`Couldn't delete temporary preview page ${page.id}:`, err)
    );
  }
}

/**
 * Wireframes for layouts, from the cache or built now (a few at a time).
 * Workspace layouts with a saved orientation always use it.
 */
export async function getLayoutPreviews(
  feltMapId: string,
  layoutIds: string[],
  orientation: "portrait" | "landscape"
): Promise<LayoutPreview[]> {
  const all = await fetchLayouts(feltMapId);
  const wanted = all.filter((l) => layoutIds.includes(l.id));
  const results: LayoutPreview[] = [];
  const queue = [...wanted];

  async function worker() {
    for (let layout = queue.shift(); layout; layout = queue.shift()) {
      const o = layout.orientation ?? orientation;
      const contentsKey = JSON.stringify(layout.contents ?? null);
      const cached = await db.printLayoutPreview.findUnique({
        where: { feltLayoutId_orientation: { feltLayoutId: layout.id, orientation: o } },
      });
      if (cached && cached.contentsKey === contentsKey) {
        results.push({ layoutId: layout.id, orientation: o, aspect: cached.aspect, items: cached.items as unknown as PreviewItem[] });
        continue;
      }
      try {
        const preview = await buildPreview(feltMapId, layout, o);
        const data = { contentsKey, aspect: preview.aspect, items: preview.items as unknown as Prisma.InputJsonValue };
        await db.printLayoutPreview.upsert({
          where: { feltLayoutId_orientation: { feltLayoutId: layout.id, orientation: o } },
          create: { feltLayoutId: layout.id, orientation: o, ...data },
          update: data,
        });
        results.push(preview);
      } catch (err) {
        console.error(`Couldn't build a preview for print layout ${layout.id}:`, err);
      }
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  return results;
}

/** Previews for the layouts this viewer's org may print with. */
export async function getPrintPreviews(
  viewer: Viewer,
  feltMapId: string,
  layoutIds: string[],
  orientation: "portrait" | "landscape"
) {
  const map = await authorize(viewer, feltMapId);
  const allowed = new Set((await allowedLayouts(feltMapId, map.orgId)).map((l) => l.id));
  return getLayoutPreviews(feltMapId, layoutIds.filter((id) => allowed.has(id)).slice(0, 30), orientation);
}

async function mapPages(feltMapId: string): Promise<PrintPageOption[]> {
  const pages = await feltFetch<FeltPrintPage[]>(`${path(feltMapId)}/print_pages`);
  return pages
    .filter((p) => p.name !== TEMP_PAGE_NAME)
    .map((p, i) => ({
      id: p.id,
      name: p.name?.trim() || `Page ${i + 1}`,
      size: p.page.size,
      orientation: p.page.orientation,
      format: p.output.format,
    }));
}

export async function listPrintOptions(viewer: Viewer, feltMapId: string) {
  const map = await authorize(viewer, feltMapId);
  const [layouts, pages] = await Promise.all([allowedLayouts(feltMapId, map.orgId), mapPages(feltMapId)]);
  return { layouts, pages };
}

function logPrint(map: { orgId: string; id: string }, viewer: Viewer, detail: Record<string, unknown>) {
  console.info(JSON.stringify({ event: "felt_print", orgId: map.orgId, mapId: map.id, userId: viewer.id, ...detail }));
}

interface FeltLayerInfo {
  id: string;
  name: string;
  status?: string;
  style?: Record<string, unknown> | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const listLayers = (mapId: string) => feltFetch<FeltLayerInfo[]>(`${path(mapId)}/layers`);

/** Make a page on `mapId` from the layout, export it, delete the page. */
async function exportLayoutPage(
  mapId: string,
  layoutId: string,
  req: PrintRequest,
  layerIds: string[] | undefined,
  naming: { title: string; fileName: string }
): Promise<FeltPrintExport> {
  const page = await feltFetch<FeltPageDetail>(`${path(mapId)}/print_pages`, {
    method: "POST",
    body: {
      name: naming.fileName,
      layout_id: layoutId,
      page: { size: req.size, orientation: req.orientation },
      output: { format: req.format, dpi: req.dpi },
      ...(req.bounds && { map_view: { bounds: req.bounds } }),
    },
  });
  try {
    const updates: Record<string, unknown>[] = [];
    // Show the same layers the viewer has turned on, on every map in the layout.
    if (layerIds) {
      for (const it of page.items) if (it.type === "map") updates.push({ id: it.id, layer_ids: layerIds });
    }
    // Put the chosen title wherever the layout shows the map's title. (On a
    // filtered print the map is a temporary copy, so its own title is wrong.)
    for (const it of page.items) {
      if (it.type === "text" && it.text && MAP_TITLE_TOKEN.test(it.text)) {
        updates.push({ id: it.id, text: it.text.replace(MAP_TITLE_TOKENS, naming.title) });
      }
    }
    if (updates.length > 0) {
      await feltFetch(`${path(mapId)}/print_pages/${encodeURIComponent(page.id)}/items`, {
        method: "POST",
        body: { items: updates },
      });
    }
    return await feltFetch<FeltPrintExport>(`${path(mapId)}/print_pages/${encodeURIComponent(page.id)}/exports`, {
      method: "POST",
    });
  } finally {
    await feltFetch(`${path(mapId)}/print_pages/${encodeURIComponent(page.id)}`, { method: "DELETE" }).catch((err) =>
      console.error(`Couldn't delete temporary print page ${page.id} on map ${mapId}:`, err)
    );
  }
}

/**
 * Print with the viewer's filters: copy the map into the same private project
 * (locked down like any portal map), save the filters into the copy's layer
 * styles, print the copy, delete it. The original map is never changed.
 */
async function exportFilteredCopy(
  feltMapId: string,
  layoutId: string,
  req: PrintRequest,
  filters: { layerId: string; filters: unknown }[],
  naming: { title: string; fileName: string }
): Promise<FeltPrintExport> {
  const [original, originalLayers] = await Promise.all([getMap(feltMapId), listLayers(feltMapId)]);
  const copy = await duplicateMapIntoProject(feltMapId, original.project_id, TEMP_PRINT_MAP_TITLE);
  try {
    // Wait for the copy's layers to finish processing.
    let copyLayers: FeltLayerInfo[] = [];
    const deadline = Date.now() + 90_000;
    for (;;) {
      copyLayers = await listLayers(copy.id);
      const ready = copyLayers.length >= originalLayers.length && copyLayers.every((l) => !l.status || l.status === "completed");
      if (ready) break;
      if (Date.now() > deadline) throw new PrintError("The filtered print took too long to prepare. Please try again.", 504);
      await sleep(2000);
    }

    // Match copied layers to the originals: same id if Felt keeps ids, else
    // same position and name.
    const toCopyId = new Map<string, string>();
    for (const [i, layer] of originalLayers.entries()) {
      const sameId = copyLayers.find((c) => c.id === layer.id);
      const samePlace = copyLayers[i]?.name === layer.name ? copyLayers[i] : undefined;
      const sameName = copyLayers.filter((c) => c.name === layer.name);
      const match = sameId ?? samePlace ?? (sameName.length === 1 ? sameName[0] : undefined);
      if (match) toCopyId.set(layer.id, match.id);
    }

    for (const f of filters) {
      const copyLayerId = toCopyId.get(f.layerId);
      if (!copyLayerId) throw new PrintError("Couldn't match the map's layers to apply your filters.", 502);
      const layer = await feltFetch<FeltLayerInfo>(`${path(copy.id)}/layers/${encodeURIComponent(copyLayerId)}`);
      if (!layer.style) throw new PrintError("Couldn't read a layer's style to apply your filters.", 502);
      // The SDK's `combined` filters already include the saved style's own filters.
      await feltFetch(`${path(copy.id)}/layers/${encodeURIComponent(copyLayerId)}/update_style`, {
        method: "POST",
        body: { style: { ...layer.style, filters: f.filters } },
      });
    }

    const layerIds = req.layerIds?.map((id) => toCopyId.get(id)).filter((id): id is string => !!id);
    return await exportLayoutPage(copy.id, layoutId, req, layerIds, naming);
  } finally {
    await deleteMap(copy.id).catch((err) =>
      console.error(`Couldn't delete temporary print copy ${copy.id} of map ${feltMapId} (sync cleans it up later):`, err)
    );
  }
}

/** Print the map with a layout (and, if given, the viewer's filters). */
export async function printWithLayout(viewer: Viewer, feltMapId: string, req: PrintRequest): Promise<FeltPrintExport> {
  const map = await authorize(viewer, feltMapId);
  const layout = (await allowedLayouts(feltMapId, map.orgId)).find((l) => l.id === req.layoutId);
  if (!layout) throw new PrintError("That layout isn't available", 400);

  const title = cleanPrintText(req.title ?? "", 200) || map.title;
  const naming = { title, fileName: cleanPrintText(req.fileName ?? "", 120) || title };
  const filtered = !!req.filters?.length;
  const result = filtered
    ? await exportFilteredCopy(feltMapId, layout.id, req, req.filters!, naming)
    : await exportLayoutPage(feltMapId, layout.id, req, req.layerIds, naming);
  logPrint(map, viewer, { layout: layout.name, size: req.size, format: req.format, filtered });
  return result;
}

/** Export a print page designed on this map in Felt, exactly as designed. */
export async function printSavedPage(viewer: Viewer, feltMapId: string, pageId: string): Promise<FeltPrintExport> {
  const map = await authorize(viewer, feltMapId);
  const page = (await mapPages(feltMapId)).find((p) => p.id === pageId);
  if (!page) throw new PrintError("That page isn't on this map", 404);
  const result = await feltFetch<FeltPrintExport>(
    `${path(feltMapId)}/print_pages/${encodeURIComponent(page.id)}/exports`,
    { method: "POST" }
  );
  logPrint(map, viewer, { page: page.name, format: page.format });
  return result;
}
