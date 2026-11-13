import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { feltFetch } from "./client";
import { getViewableMap, type Viewer } from "./access";

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

/** Print the map with a layout: temporary page → export → delete the page. */
export async function printWithLayout(viewer: Viewer, feltMapId: string, req: PrintRequest): Promise<FeltPrintExport> {
  const map = await authorize(viewer, feltMapId);
  const layout = (await allowedLayouts(feltMapId, map.orgId)).find((l) => l.id === req.layoutId);
  if (!layout) throw new PrintError("That layout isn't available", 400);

  const page = await feltFetch<{ id: string }>(`${path(feltMapId)}/print_pages`, {
    method: "POST",
    body: {
      name: TEMP_PAGE_NAME,
      layout_id: layout.id,
      page: { size: req.size, orientation: req.orientation },
      output: { format: req.format, dpi: req.dpi },
      ...(req.bounds && { map_view: { bounds: req.bounds } }),
    },
  });
  try {
    const result = await feltFetch<FeltPrintExport>(
      `${path(feltMapId)}/print_pages/${encodeURIComponent(page.id)}/exports`,
      { method: "POST" }
    );
    logPrint(map, viewer, { layout: layout.name, size: req.size, format: req.format });
    return result;
  } finally {
    await feltFetch(`${path(feltMapId)}/print_pages/${encodeURIComponent(page.id)}`, { method: "DELETE" }).catch((err) =>
      console.error(`Couldn't delete temporary print page ${page.id} on map ${feltMapId}:`, err)
    );
  }
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
