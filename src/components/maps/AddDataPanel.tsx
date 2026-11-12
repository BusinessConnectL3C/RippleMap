"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, AlertTriangle, Loader2, Upload, Link2, X, RefreshCw, Info, PenLine } from "lucide-react";
import { AddRecordsForm } from "@/components/maps/AddRecordsForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface UploadRow {
  id: string;
  kind: "FILE" | "URL";
  mode?: "NEW" | "REPLACE" | "APPEND";
  layerName: string;
  status: "PENDING_UPLOAD" | "IMPORTING" | "COMPLETED" | "FAILED";
  error: string | null;
  createdAt: string;
}

interface ReplaceableLayer {
  uploadId: string;
  layerName: string;
  kind: "FILE" | "URL";
  fileExt: string | null;
  sourceUrl: string | null;
  columns: string[];
}

interface Props {
  feltMapId: string;
  planLabel: string;
  maxFileBytes: number;
  maxUploadsPerMap: number | null;
  used: number;
  recent: UploadRow[];
  accept: string;
}

type Mode = "file" | "url" | "replace" | "records";

type Phase =
  | { step: "idle" }
  | { step: "uploading"; percent: number }
  | { step: "importing" }
  | { step: "done"; layerName: string; replaced: boolean; records?: number }
  | { step: "error"; message: string };

const POLL_MS = 3000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${Math.round(mb / 1024)} GB` : `${Math.round(mb)} MB`;
}

function stripExtension(name: string): string {
  return name.replace(/\.[A-Za-z0-9]+$/, "").replace(/[_-]+/g, " ").trim();
}

/** Lower-case and drop non-alphanumerics: Felt may normalise column names. */
function normaliseColumn(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Column names from a CSV's header row (handles simple quoting). */
async function readCsvHeader(file: File): Promise<string[]> {
  const text = await file.slice(0, 64 * 1024).text();
  const line = text.split(/\r?\n/)[0] ?? "";
  const cols: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === "," && !quoted) {
      cols.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  cols.push(cur.trim());
  return cols.filter(Boolean);
}

/** PUT the file straight to S3 with progress. Content-Type must match the signature. */
function putWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () =>
      reject(new Error("The upload was blocked or interrupted. Check your connection and try again; if it keeps happening, contact support."));
    xhr.send(file);
  });
}

export function AddDataPanel({ feltMapId, planLabel, maxFileBytes, maxUploadsPerMap, used, recent, accept }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("file");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [layerName, setLayerName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Replace data
  const [layers, setLayers] = useState<ReplaceableLayer[] | null>(null);
  const [layersError, setLayersError] = useState<string | null>(null);
  const [legacyLayers, setLegacyLayers] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [replaceAck, setReplaceAck] = useState(false);
  const [missingColumns, setMissingColumns] = useState<string[]>([]);

  useEffect(() => () => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
  }, []);

  const atLimit = maxUploadsPerMap !== null && used >= maxUploadsPerMap;
  const busy = phase.step === "uploading" || phase.step === "importing";
  const base = `/api/felt/maps/${encodeURIComponent(feltMapId)}/uploads`;
  const selected = layers?.find((l) => l.uploadId === selectedId) ?? null;

  function poll(uploadId: string, name: string, startedAt: number, replaced: boolean, records?: number) {
    pollTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${base}/${uploadId}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        const status: UploadRow["status"] | undefined = data?.upload?.status;
        if (status === "COMPLETED") {
          setPhase({ step: "done", layerName: name, replaced, records });
          router.refresh();
          return;
        }
        if (status === "FAILED") {
          setPhase({ step: "error", message: data.upload.error ?? "Felt couldn't process that data." });
          router.refresh();
          return;
        }
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          setPhase({ step: "error", message: "This is taking a while. The map will update when Felt finishes." });
          return;
        }
        poll(uploadId, name, startedAt, replaced, records);
      } catch {
        poll(uploadId, name, startedAt, replaced, records);
      }
    }, POLL_MS);
  }

  /** Reserve, PUT to S3, hand to Felt, then poll. Shared by new layers and replacements. */
  async function uploadFile(f: File, extra: Record<string, unknown>, name: string, replaced: boolean) {
    if (f.size > maxFileBytes) {
      setPhase({ step: "error", message: `That file is ${formatBytes(f.size)}. Your plan allows up to ${formatBytes(maxFileBytes)}.` });
      return;
    }
    setPhase({ step: "uploading", percent: 0 });
    try {
      const start = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "FILE", fileName: f.name, sizeBytes: f.size, confirmed, ...extra }),
      });
      const startData = await start.json().catch(() => null);
      if (!start.ok) throw new Error(startData?.error ?? "Couldn't start the upload.");

      try {
        await putWithProgress(startData.putUrl, f, (percent) => setPhase({ step: "uploading", percent }));
      } catch (putErr) {
        // Release the reservation: the server sees no file and marks it failed,
        // so it doesn't count toward the plan's upload limit.
        await fetch(`${base}/${startData.uploadId}/complete`, { method: "POST" }).catch(() => {});
        throw putErr;
      }

      setPhase({ step: "importing" });
      const done = await fetch(`${base}/${startData.uploadId}/complete`, { method: "POST" });
      const doneData = await done.json().catch(() => null);
      if (!done.ok) throw new Error(doneData?.error ?? "Couldn't hand the file to Felt.");
      if (doneData.upload.status === "FAILED") throw new Error(doneData.upload.error);
      poll(startData.uploadId, name, Date.now(), replaced);
    } catch (err) {
      setPhase({ step: "error", message: err instanceof Error ? err.message : "Upload failed." });
      router.refresh();
    }
  }

  async function postAndPoll(
    body: Record<string, unknown>,
    name: string,
    replaced: boolean,
    fallbackError: string,
    records?: number
  ) {
    setPhase({ step: "importing" });
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? fallbackError);
      if (data.upload.status === "FAILED") throw new Error(data.upload.error);
      poll(data.upload.id, name, Date.now(), replaced, records);
    } catch (err) {
      setPhase({ step: "error", message: err instanceof Error ? err.message : fallbackError });
      router.refresh();
    }
  }

  async function submit() {
    if (!confirmed) return;

    if (mode === "replace") {
      if (!selected || !replaceAck) return;
      if (selected.kind === "URL") {
        await postAndPoll(
          { kind: "REFRESH_LINK", replacesUploadId: selected.uploadId, confirmed },
          selected.layerName,
          true,
          "Couldn't refresh from that link."
        );
      } else if (file) {
        await uploadFile(file, { replacesUploadId: selected.uploadId }, selected.layerName, true);
      }
      return;
    }

    const name = layerName.trim();
    if (!name) return;
    if (mode === "file") {
      if (file) await uploadFile(file, { layerName: name }, name, false);
      return;
    }
    await postAndPoll({ kind: "URL", url: url.trim(), layerName: name, confirmed }, name, false, "Couldn't add that link.");
  }

  async function chooseMode(next: Mode) {
    setMode(next);
    setFile(null);
    setMissingColumns([]);
    if (next !== "replace" || layers !== null) return;
    setLayersError(null);
    try {
      const res = await fetch(base, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Couldn't load this map's layers.");
      setLayers(data.layers);
      setLegacyLayers(data.legacy ?? []);
    } catch (err) {
      setLayersError(err instanceof Error ? err.message : "Couldn't load this map's layers.");
    }
  }

  async function checkColumns(f: File | null, layer: ReplaceableLayer | null) {
    setMissingColumns([]);
    if (!f || !layer || layer.fileExt !== "csv" || layer.columns.length === 0) return;
    const incoming = new Set((await readCsvHeader(f)).map(normaliseColumn));
    setMissingColumns(layer.columns.filter((c) => !incoming.has(normaliseColumn(c))));
  }

  function reset() {
    setFile(null);
    setUrl("");
    setLayerName("");
    setConfirmed(false);
    setReplaceAck(false);
    setSelectedId("");
    setMissingColumns([]);
    setLayers(null);
    setMode("file");
    setPhase({ step: "idle" });
  }

  const ready =
    confirmed &&
    (mode === "replace"
      ? !!selected && replaceAck && (selected.kind === "URL" || !!file)
      : !!layerName.trim() && (mode === "file" ? !!file : !!url.trim()));

  const tab = (value: Mode, label: string, Icon: typeof Upload) => (
    <Button
      size="sm"
      role="tab"
      aria-selected={mode === value}
      variant={mode === value ? "default" : "outline"}
      className="gap-1.5"
      disabled={busy}
      onClick={() => chooseMode(value)}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </Button>
  );

  return (
    <div className="border-b border-border bg-surface-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <p className="text-xs text-text-muted">
          {planLabel} plan · files up to {formatBytes(maxFileBytes)}
          {maxUploadsPerMap !== null && ` · ${used} of ${maxUploadsPerMap} uploads used on this map`}
        </p>
        <Button size="sm" variant={open ? "outline" : "default"} className="gap-1.5" onClick={() => setOpen((o) => !o)}>
          {open ? <X className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
          {open ? "Close" : "Add data"}
        </Button>
      </div>

      {open && (
        <div className="space-y-4 px-4 pb-4 sm:px-6">
          {atLimit && phase.step === "idle" && mode !== "records" ? (
            <p className="text-sm text-text-secondary">
              This map has used all {maxUploadsPerMap} uploads on the {planLabel} plan. Contact BC through Support to
              upgrade. You can still{" "}
              <button type="button" className="font-semibold text-link hover:underline" onClick={() => chooseMode("records")}>
                add records by hand
              </button>
              .
            </p>
          ) : phase.step === "done" ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <CheckCircle2 className="h-5 w-5 text-[var(--success)]" aria-hidden="true" />
              <span>
                {phase.records ? (
                  <>
                    {phase.records === 1 ? "1 record was" : `${phase.records} records were`} added to{" "}
                    <strong>{phase.layerName}</strong>.
                  </>
                ) : phase.replaced ? (
                  <>
                    <strong>{phase.layerName}</strong> now has the new data. Its styling and charts were kept.
                  </>
                ) : (
                  <>
                    <strong>{phase.layerName}</strong> was added. It appears in the map&apos;s legend; you may need to
                    zoom to it.
                  </>
                )}
              </span>
              <Button size="sm" variant="outline" onClick={reset}>
                Add more data
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Data source">
                {tab("file", "Upload a file", Upload)}
                {tab("url", "Paste a link", Link2)}
                {tab("replace", "Replace a layer's data", RefreshCw)}
                {tab("records", "Add records", PenLine)}
              </div>

              {mode === "records" ? (
                <>
                  <AddRecordsForm
                    base={base}
                    busy={busy}
                    onSave={(body, name, count) =>
                      postAndPoll(body, name, false, "Couldn't add the records.", count)
                    }
                  />
                  {phase.step === "error" && (
                    <p className="flex items-start gap-2 text-sm text-[var(--danger)]" role="alert">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      {phase.message}
                    </p>
                  )}
                </>
              ) : mode === "replace" ? (
                <div className="space-y-3">
                  {layersError ? (
                    <p className="text-sm text-[var(--danger)]" role="alert">
                      {layersError}
                    </p>
                  ) : layers === null ? (
                    <p className="flex items-center gap-2 text-sm text-text-muted">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading layers…
                    </p>
                  ) : layers.length === 0 ? (
                    <p className="text-sm text-text-secondary">
                      No layers on this map can be replaced yet. Only layers added here with Add data can be replaced;
                      layers built in Felt, or that collect field data, are left alone.
                    </p>
                  ) : null}

                  {legacyLayers.length > 0 && (
                    <div className="flex gap-2 rounded-md border border-border bg-surface-page p-3 text-sm text-text-secondary">
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
                      <p>
                        <strong className="text-text-primary">{legacyLayers.join(", ")}</strong>{" "}
                        {legacyLayers.length === 1 ? "was" : "were"} added before data replacement was available, so{" "}
                        {legacyLayers.length === 1 ? "it can't" : "they can't"} be replaced. To make a layer replaceable,
                        add the file again with <strong>Upload a file</strong>, then delete the old layer in the map.
                      </p>
                    </div>
                  )}

                  {layers !== null && layers.length > 0 && (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="replace-layer">Layer</Label>
                          <Select
                            value={selectedId}
                            disabled={busy}
                            onValueChange={(id) => {
                              setSelectedId(id);
                              setFile(null);
                              setMissingColumns([]);
                            }}
                          >
                            <SelectTrigger id="replace-layer">
                              <SelectValue placeholder="Choose a layer" />
                            </SelectTrigger>
                            <SelectContent>
                              {layers.map((l) => (
                                <SelectItem key={l.uploadId} value={l.uploadId}>
                                  {l.layerName} {l.kind === "URL" ? "(from a link)" : l.fileExt ? `(.${l.fileExt})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {selected?.kind === "FILE" && (
                          <div className="space-y-1.5">
                            <Label htmlFor="replace-file">New file</Label>
                            <Input
                              id="replace-file"
                              type="file"
                              accept={selected.fileExt ? `.${selected.fileExt}` : accept}
                              disabled={busy}
                              onChange={(e) => {
                                const f = e.target.files?.[0] ?? null;
                                setFile(f);
                                checkColumns(f, selected);
                              }}
                            />
                            <p className="text-xs text-text-muted">
                              Must be a {selected.fileExt ? `.${selected.fileExt}` : "same-type"} file with every row you
                              want in the layer.
                            </p>
                          </div>
                        )}

                        {selected?.kind === "URL" && (
                          <div className="space-y-1.5">
                            <Label>Source link</Label>
                            <p className="break-all rounded bg-surface-page px-2 py-1.5 text-xs text-text-secondary">
                              {selected.sourceUrl}
                            </p>
                            <p className="text-xs text-text-muted">Felt will fetch this link again and use what&apos;s there now.</p>
                          </div>
                        )}
                      </div>

                      {missingColumns.length > 0 && (
                        <div className="flex gap-2 rounded-md border border-[var(--warning)] bg-[var(--warning-subtle)] p-3 text-sm">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--yellow-500)]" aria-hidden="true" />
                          <p>
                            Your file is missing {missingColumns.length === 1 ? "a column" : "columns"} the layer has now:{" "}
                            <strong>{missingColumns.join(", ")}</strong>. Styling, filters or charts that use{" "}
                            {missingColumns.length === 1 ? "it" : "them"} will stop working.
                          </p>
                        </div>
                      )}

                      {selected && (
                        <label className="flex items-start gap-2 text-sm text-text-secondary">
                          <input
                            id="replace-ack"
                            type="checkbox"
                            className="mt-1"
                            checked={replaceAck}
                            disabled={busy}
                            onChange={(e) => setReplaceAck(e.target.checked)}
                          />
                          <span>
                            I understand this <strong>replaces all the data</strong> in <strong>{selected.layerName}</strong>,
                            including any changes made to it on the map. Felt keeps no earlier version. Styling and charts
                            are kept.
                          </span>
                        </label>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {mode === "file" ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="add-data-file">File</Label>
                      <Input
                        id="add-data-file"
                        type="file"
                        accept={accept}
                        disabled={busy}
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          setFile(f);
                          if (f && !layerName) setLayerName(stripExtension(f.name));
                        }}
                      />
                      <p className="text-xs text-text-muted">
                        CSV or Excel (with addresses or latitude/longitude columns), GeoJSON, KML/KMZ, GPX, GeoPackage,
                        GeoTIFF, Parquet. Zip Shapefiles first.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label htmlFor="add-data-url">Link</Label>
                      <Input
                        id="add-data-url"
                        type="url"
                        value={url}
                        disabled={busy}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://…"
                      />
                      <p className="text-xs text-text-muted">
                        A public Google Sheet, a hosted data file, or an ArcGIS FeatureServer/MapServer URL.
                      </p>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="add-data-name">Layer name</Label>
                    <Input
                      id="add-data-name"
                      value={layerName}
                      disabled={busy}
                      maxLength={120}
                      onChange={(e) => setLayerName(e.target.value)}
                      placeholder="e.g. Volunteer sites"
                    />
                  </div>
                </div>
              )}

              {mode !== "records" && (mode !== "replace" || (layers !== null && layers.length > 0)) && (
                <>
              <label className="flex items-start gap-2 text-sm text-text-secondary">
                <input
                  id="add-data-confirm"
                  type="checkbox"
                  className="mt-1"
                  checked={confirmed}
                  disabled={busy}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>
                  This data contains no personal or sensitive information, such as people&apos;s names with home
                  addresses, health, financial or ID details. It will be stored with our mapping provider, Felt.
                </span>
              </label>

              {phase.step === "error" && (
                <p className="flex items-start gap-2 text-sm text-[var(--danger)]" role="alert">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {phase.message}
                </p>
              )}

              <div className="flex items-center gap-3">
                <Button onClick={submit} disabled={!ready || busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {phase.step === "uploading"
                    ? `Uploading… ${phase.percent}%`
                    : phase.step === "importing"
                      ? mode === "replace"
                        ? "Replacing data…"
                        : "Adding to map…"
                      : mode === "replace"
                        ? selected?.kind === "URL"
                          ? "Refresh from link"
                          : "Replace data"
                        : "Add to map"}
                </Button>
                {phase.step === "importing" && (
                  <span className="text-xs text-text-muted">Felt is processing the data. Large files can take a few minutes.</span>
                )}
              </div>
                </>
              )}
            </>
          )}

          {recent.length > 0 && (
            <div className="space-y-1 border-t border-border pt-3">
              <p className="text-xs font-medium text-text-secondary">Recent uploads</p>
              <ul className="space-y-1 text-sm">
                {recent.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center gap-2">
                    <span className="text-text-primary">{u.layerName}</span>
                    <span className="text-xs text-text-muted">{new Date(u.createdAt).toLocaleDateString()}</span>
                    <span
                      className={`text-xs ${
                        u.status === "COMPLETED"
                          ? "text-[var(--success)]"
                          : u.status === "FAILED"
                            ? "text-[var(--danger)]"
                            : "text-text-muted"
                      }`}
                    >
                      {u.status === "COMPLETED"
                        ? u.mode === "REPLACE"
                          ? "Replaced"
                          : u.mode === "APPEND"
                            ? "Records added"
                            : "Added"
                        : u.status === "FAILED"
                          ? u.error ?? "Failed"
                          : "In progress"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
