#!/usr/bin/env node
/**
 * Prototype: can the portal print a map WITH a viewer's filters?
 *
 * Felt's print API takes no filters, so the idea is: duplicate the map into
 * the same private project, write the filters into the copy's layer styles,
 * print the copy, delete it. This script runs that once against one map and
 * reports what works. The original map is never modified; the copy and the
 * print page are always deleted (also on errors).
 *
 *   npm run felt:print-probe -- --map <feltMapId> --layer "<layer name>" --filter '["status","eq","Active"]'
 *
 * --map     Felt map id (from the map's portal URL /maps/f/<id> or Felt link)
 * --layer   Layer to filter (exact name, case-insensitive). Default: first point/line/polygon layer.
 * --filter  Felt Style Language filter as JSON, e.g. '["volunteers","gt",10]'.
 *           Default: none (tests copy + print only).
 * --out     Where to save the PDF. Default: ./felt-print-probe.pdf
 *
 * Requires FELT_API_TOKEN (loaded from .env if present). The token is only
 * sent to felt.com and never printed.
 */
import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

const API = "https://felt.com/api/v2";
const TEMP_NAME = "RippleMap portal print (temporary)";

const { values: args } = parseArgs({
  options: {
    map: { type: "string" },
    layer: { type: "string" },
    filter: { type: "string" },
    out: { type: "string", default: "felt-print-probe.pdf" },
  },
});

const token = process.env.FELT_API_TOKEN?.trim();
if (!token) fail("FELT_API_TOKEN is not set (add it to .env; don't paste it anywhere else).");
if (!args.map) fail("Pass --map <feltMapId>.");
let filter = null;
if (args.filter) {
  try {
    filter = JSON.parse(args.filter);
  } catch {
    fail("--filter must be JSON, e.g. '[\"volunteers\",\"gt\",10]'");
  }
}

const t0 = Date.now();
const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
const findings = [];
function log(step, detail) {
  console.log(`[${elapsed()}] ${step}${detail ? `: ${detail}` : ""}`);
}
function note(ok, text) {
  findings.push(`${ok ? "OK  " : "FAIL"} ${text}`);
  log(ok ? "✓" : "✗", text);
}
function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function felt(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body !== undefined && { "Content-Type": "application/json" }) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const detail = data?.errors?.[0]?.detail ?? data?.errors?.[0]?.title ?? String(text).slice(0, 300);
    throw new Error(`${method} ${path} → ${res.status}: ${detail}`);
  }
  return data;
}

const getLayers = (mapId) => felt(`/maps/${mapId}/layers`);
const isVector = (l) => ["Point", "Line", "Polygon"].includes(l.geometry_type);

let copyId = null;
let pageId = null;
let originalStyles = null;

try {
  // 1. The original map.
  const original = await felt(`/maps/${args.map}`);
  log("Original map", `"${original.title}" in project ${original.project_id}`);
  const originalLayers = await getLayers(args.map);
  log("Original layers", originalLayers.map((l) => `${l.name} [${l.geometry_type ?? "?"}]`).join(", "));
  originalStyles = JSON.stringify(originalLayers.map((l) => l.style ?? null));

  const target =
    (args.layer && originalLayers.find((l) => l.name?.toLowerCase() === args.layer.toLowerCase())) ||
    (!args.layer && originalLayers.find(isVector));
  if (!target) fail(args.layer ? `No layer named "${args.layer}".` : "No point/line/polygon layer on this map.");
  log("Layer to filter", `${target.name} (${target.id}), attributes: ${(target.attributes ?? []).map((a) => a.name).join(", ")}`);

  // 2. Duplicate into the same private project.
  const tDup = Date.now();
  const copy = await felt(`/maps/${args.map}/duplicate`, {
    method: "POST",
    body: { title: TEMP_NAME, destination: { project_id: original.project_id } },
  });
  copyId = copy.id;
  note(true, `Duplicate returned in ${((Date.now() - tDup) / 1000).toFixed(1)}s (copy ${copyId}, same project: ${copy.project_id === original.project_id})`);

  // 3. Wait until every copied layer has finished processing.
  let copyLayers = [];
  const tReady = Date.now();
  for (;;) {
    copyLayers = await getLayers(copyId);
    const pending = copyLayers.filter((l) => l.status && l.status !== "completed");
    if (copyLayers.length >= originalLayers.length && pending.length === 0) break;
    if (Date.now() - tReady > 120_000) throw new Error(`Copy's layers not ready after 120 s (${pending.length} still processing)`);
    await sleep(2000);
  }
  note(true, `Copy's ${copyLayers.length} layers ready after ${((Date.now() - tReady) / 1000).toFixed(1)}s more`);

  // 4. Match copied layers to the originals.
  const sameIds = copyLayers.some((l) => l.id === target.id);
  const byName = copyLayers.filter((l) => l.name === target.name);
  const sameOrder = copyLayers.map((l) => l.name).join("|") === originalLayers.map((l) => l.name).join("|");
  note(true, `Layer ids on the copy are ${sameIds ? "the SAME as" : "different from"} the original's; names in same order: ${sameOrder}; layers named "${target.name}": ${byName.length}`);
  const copyTarget = sameIds ? copyLayers.find((l) => l.id === target.id) : byName[0];
  if (!copyTarget) throw new Error("Couldn't find the filter layer on the copy");

  // 5. Write the filter into the copy's layer style.
  if (filter) {
    const style = copyTarget.style ?? (await felt(`/maps/${copyId}/layers/${copyTarget.id}`)).style;
    if (!style) throw new Error("Copied layer has no style to update");
    const combined = style.filters ? [style.filters, "and", filter] : filter;
    await felt(`/maps/${copyId}/layers/${copyTarget.id}/update_style`, {
      method: "POST",
      body: { style: { ...style, filters: combined } },
    });
    const after = await felt(`/maps/${copyId}/layers/${copyTarget.id}`);
    note(
      JSON.stringify(after.style?.filters) === JSON.stringify(combined),
      `Filter saved on the copy's "${copyTarget.name}" style: ${JSON.stringify(after.style?.filters)}`
    );
  } else {
    log("No --filter given", "skipping the style update");
  }

  // 6. Print the copy with Felt's Standard layout.
  const layouts = await felt(`/maps/${copyId}/print_layouts`);
  const standard = layouts.find((l) => l.kind === "built_in" && /standard/i.test(l.name)) ?? layouts.find((l) => l.kind === "built_in");
  const page = await felt(`/maps/${copyId}/print_pages`, {
    method: "POST",
    body: {
      name: TEMP_NAME,
      layout_id: standard.id,
      page: { size: "letter", orientation: "landscape" },
      output: { format: "pdf", dpi: 150 },
    },
  });
  pageId = page.id;
  const tPrint = Date.now();
  const exported = await felt(`/maps/${copyId}/print_pages/${pageId}/exports`, { method: "POST" });
  note(true, `Printed with "${standard.name}" in ${((Date.now() - tPrint) / 1000).toFixed(1)}s`);
  const pdf = await fetch(exported.download_url);
  if (!pdf.ok) throw new Error(`Download failed: ${pdf.status}`);
  await writeFile(args.out, Buffer.from(await pdf.arrayBuffer()));
  note(true, `PDF saved to ${args.out}: open it and check the filter is applied`);
} catch (err) {
  note(false, err instanceof Error ? err.message : String(err));
} finally {
  // 7. Clean up: the copy (with its print page) is deleted; the original must be unchanged.
  if (copyId) {
    try {
      if (pageId) await felt(`/maps/${copyId}/print_pages/${pageId}`, { method: "DELETE" }).catch(() => {});
      await felt(`/maps/${copyId}`, { method: "DELETE" });
      note(true, `Temporary copy ${copyId} deleted`);
    } catch (err) {
      note(false, `Couldn't delete the temporary copy ${copyId}: delete "${TEMP_NAME}" in Felt by hand (${err.message})`);
    }
  }
}

// The original map must be exactly as it was.
if (originalStyles) {
  try {
    const now = await getLayers(args.map);
    const same = JSON.stringify(now.map((l) => l.style ?? null)) === originalStyles;
    note(same, same ? "Original map's layer styles unchanged" : "Original map's layer styles CHANGED: check it in Felt");
  } catch (err) {
    note(false, `Couldn't re-read the original map: ${err.message}`);
  }
}

console.log(`\nSummary (${elapsed()} total):\n${findings.join("\n")}`);
