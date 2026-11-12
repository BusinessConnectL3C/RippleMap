"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, Loader2, Upload, Link2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface UploadRow {
  id: string;
  kind: "FILE" | "URL";
  layerName: string;
  status: "PENDING_UPLOAD" | "IMPORTING" | "COMPLETED" | "FAILED";
  error: string | null;
  createdAt: string;
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

type Phase =
  | { step: "idle" }
  | { step: "uploading"; percent: number }
  | { step: "importing" }
  | { step: "done"; layerName: string }
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
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    xhr.send(file);
  });
}

export function AddDataPanel({ feltMapId, planLabel, maxFileBytes, maxUploadsPerMap, used, recent, accept }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"file" | "url">("file");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [layerName, setLayerName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
  }, []);

  const atLimit = maxUploadsPerMap !== null && used >= maxUploadsPerMap;
  const busy = phase.step === "uploading" || phase.step === "importing";
  const base = `/api/felt/maps/${encodeURIComponent(feltMapId)}/uploads`;

  function poll(uploadId: string, name: string, startedAt: number) {
    pollTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${base}/${uploadId}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        const status: UploadRow["status"] | undefined = data?.upload?.status;
        if (status === "COMPLETED") {
          setPhase({ step: "done", layerName: name });
          router.refresh();
          return;
        }
        if (status === "FAILED") {
          setPhase({ step: "error", message: data.upload.error ?? "Felt couldn't process that data." });
          router.refresh();
          return;
        }
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          setPhase({ step: "error", message: "This is taking a while. The layer will appear on the map when Felt finishes." });
          return;
        }
        poll(uploadId, name, startedAt);
      } catch {
        poll(uploadId, name, startedAt);
      }
    }, POLL_MS);
  }

  async function submit() {
    const name = layerName.trim();
    if (!name || !confirmed) return;

    if (mode === "file") {
      if (!file) return;
      if (file.size > maxFileBytes) {
        setPhase({ step: "error", message: `That file is ${formatBytes(file.size)}. Your plan allows up to ${formatBytes(maxFileBytes)}.` });
        return;
      }
      setPhase({ step: "uploading", percent: 0 });
      try {
        const start = await fetch(base, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "FILE", fileName: file.name, sizeBytes: file.size, layerName: name, confirmed }),
        });
        const startData = await start.json().catch(() => null);
        if (!start.ok) throw new Error(startData?.error ?? "Couldn't start the upload.");

        await putWithProgress(startData.putUrl, file, (percent) => setPhase({ step: "uploading", percent }));

        setPhase({ step: "importing" });
        const done = await fetch(`${base}/${startData.uploadId}/complete`, { method: "POST" });
        const doneData = await done.json().catch(() => null);
        if (!done.ok) throw new Error(doneData?.error ?? "Couldn't hand the file to Felt.");
        if (doneData.upload.status === "FAILED") throw new Error(doneData.upload.error);
        poll(startData.uploadId, name, Date.now());
      } catch (err) {
        setPhase({ step: "error", message: err instanceof Error ? err.message : "Upload failed." });
        router.refresh();
      }
      return;
    }

    setPhase({ step: "importing" });
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "URL", url: url.trim(), layerName: name, confirmed }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Couldn't add that link.");
      if (data.upload.status === "FAILED") throw new Error(data.upload.error);
      poll(data.upload.id, name, Date.now());
    } catch (err) {
      setPhase({ step: "error", message: err instanceof Error ? err.message : "Couldn't add that link." });
      router.refresh();
    }
  }

  function reset() {
    setFile(null);
    setUrl("");
    setLayerName("");
    setConfirmed(false);
    setPhase({ step: "idle" });
  }

  const ready = !!layerName.trim() && confirmed && (mode === "file" ? !!file : !!url.trim());

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
          {atLimit && phase.step === "idle" ? (
            <p className="text-sm text-text-secondary">
              This map has used all {maxUploadsPerMap} uploads on the {planLabel} plan. Contact BC through Support to
              upgrade.
            </p>
          ) : phase.step === "done" ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <CheckCircle2 className="h-5 w-5 text-[var(--success)]" aria-hidden="true" />
              <span>
                <strong>{phase.layerName}</strong> was added. It appears in the map&apos;s legend; you may need to zoom
                to it.
              </span>
              <Button size="sm" variant="outline" onClick={reset}>
                Add more data
              </Button>
            </div>
          ) : (
            <>
              <div className="flex gap-2" role="tablist" aria-label="Data source">
                <Button
                  size="sm"
                  role="tab"
                  aria-selected={mode === "file"}
                  variant={mode === "file" ? "default" : "outline"}
                  className="gap-1.5"
                  disabled={busy}
                  onClick={() => setMode("file")}
                >
                  <Upload className="h-3.5 w-3.5" /> Upload a file
                </Button>
                <Button
                  size="sm"
                  role="tab"
                  aria-selected={mode === "url"}
                  variant={mode === "url" ? "default" : "outline"}
                  className="gap-1.5"
                  disabled={busy}
                  onClick={() => setMode("url")}
                >
                  <Link2 className="h-3.5 w-3.5" /> Paste a link
                </Button>
              </div>

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
                      ? "Adding to map…"
                      : "Add to map"}
                </Button>
                {phase.step === "importing" && (
                  <span className="text-xs text-text-muted">Felt is processing the data. Large files can take a few minutes.</span>
                )}
              </div>
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
                      {u.status === "COMPLETED" ? "Added" : u.status === "FAILED" ? u.error ?? "Failed" : "In progress"}
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
