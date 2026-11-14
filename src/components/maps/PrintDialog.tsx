"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileText, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { LayoutWireframe, type WireframeItem } from "@/components/maps/LayoutWireframe";

interface LayoutOption {
  id: string;
  name: string;
  branded: boolean;
  orientation: "portrait" | "landscape" | null;
  assigned: boolean;
  isDefault: boolean;
}

interface Preview {
  layoutId: string;
  orientation: "portrait" | "landscape";
  aspect: number;
  items: WireframeItem[];
}

/** Letter page proportions, for wireframes still loading. */
const LETTER_ASPECT = { landscape: 11 / 8.5, portrait: 8.5 / 11 };

interface PageOption {
  id: string;
  name: string;
  size: string;
  orientation: "portrait" | "landscape";
  format: string;
}

type Bounds = [number, number, number, number];

/** What the viewer currently sees (read from the Felt embed). */
export interface ViewState {
  bounds: Bounds;
  visibleLayerIds: string[];
  allLayersVisible: boolean;
  /** Legend/viewer filters per layer (Felt Style Language), printed via a temporary map copy. */
  filters: { layerId: string; filters: unknown }[];
  /** Legend categories switched off; those can't be carried into a print. */
  hiddenCategory: boolean;
}

interface Props {
  feltMapId: string;
  /** The map's title: the default title and file name for prints. */
  mapTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The viewer's current map view, read when printing; null if the map isn't ready. */
  getViewState: () => Promise<ViewState | null>;
}

const SIZES = [
  { value: "letter", label: "Letter (8.5 × 11 in)" },
  { value: "tabloid", label: "Tabloid (11 × 17 in)" },
  { value: "a4", label: "A4" },
  { value: "a3", label: "A3" },
] as const;

type State =
  | { step: "idle" }
  | { step: "printing"; label: string }
  | { step: "done"; url: string; filename: string }
  | { step: "error"; message: string };

function startDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function PrintDialog({ feltMapId, mapTitle, open, onOpenChange, getViewState }: Props) {
  const [printTitle, setPrintTitle] = useState(mapTitle);
  // The file name follows the title until someone edits it.
  const [fileName, setFileName] = useState(mapTitle);
  const [fileNameEdited, setFileNameEdited] = useState(false);
  const [viewState, setViewState] = useState<ViewState | null>(null);
  // Read the viewer's map state each time the dialog opens, for the note below.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getViewState().then((v) => !cancelled && setViewState(v));
    return () => {
      cancelled = true;
    };
  }, [open, getViewState]);
  const base = `/api/felt/maps/${encodeURIComponent(feltMapId)}/print`;
  const [options, setOptions] = useState<{ layouts: LayoutOption[]; pages: PageOption[] } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [layoutId, setLayoutId] = useState("");
  const [size, setSize] = useState<(typeof SIZES)[number]["value"]>("letter");
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [format, setFormat] = useState<"pdf" | "png" | "jpg">("pdf");
  const [dpi, setDpi] = useState<150 | 300>(300);
  const [view, setView] = useState<"current" | "saved">("current");
  const [state, setState] = useState<State>({ step: "idle" });
  // Wireframes per orientation, keyed by layout id. Built-ins follow the chosen
  // orientation; saved layouts keep their own.
  const [previews, setPreviews] = useState<Record<string, Record<string, Preview>>>({});

  useEffect(() => {
    if (!options || options.layouts.length === 0 || previews[orientation]) return;
    let cancelled = false;
    const ids = options.layouts.map((l) => l.id).join(",");
    fetch(`${base}/previews?ids=${encodeURIComponent(ids)}&orientation=${orientation}`)
      .then((res) => (res.ok ? res.json() : { previews: [] }))
      .then((data: { previews: Preview[] }) => {
        if (cancelled) return;
        setPreviews((p) => ({ ...p, [orientation]: Object.fromEntries(data.previews.map((pv) => [pv.layoutId, pv])) }));
      })
      .catch(() => !cancelled && setPreviews((p) => ({ ...p, [orientation]: {} })));
    return () => {
      cancelled = true;
    };
  }, [options, orientation, previews, base]);

  useEffect(() => {
    if (!open || options) return;
    let cancelled = false;
    fetch(base, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Couldn't load print layouts.");
        if (cancelled) return;
        setOptions(data);
        // The org's default comes first when it has one.
        const first = data.layouts[0] as LayoutOption | undefined;
        if (first) {
          setLayoutId(first.id);
          if (first.orientation) setOrientation(first.orientation);
        }
      })
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : "Couldn't load print layouts."));
    return () => {
      cancelled = true;
    };
  }, [open, options, base]);

  const printing = state.step === "printing";

  async function request(body: Record<string, unknown>, label: string) {
    setState({ step: "printing", label });
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Couldn't make the print.");
      setState({ step: "done", url: data.downloadUrl, filename: data.filename });
      startDownload(data.downloadUrl, data.filename);
    } catch (err) {
      setState({ step: "error", message: err instanceof Error ? err.message : "Couldn't make the print." });
    }
  }

  async function printLayout() {
    const layout = options?.layouts.find((l) => l.id === layoutId);
    if (!layout) return;
    const current = view === "current" ? await getViewState() : null;
    await request(
      {
        kind: "LAYOUT",
        layoutId,
        size,
        orientation,
        format,
        dpi,
        title: printTitle.trim() || mapTitle,
        fileName: fileName.trim() || printTitle.trim() || mapTitle,
        ...(current && { bounds: current.bounds, layerIds: current.visibleLayerIds }),
        ...(current && current.filters.length > 0 && { filters: current.filters }),
      },
      layout.name
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (printing) return; // keep the dialog while Felt renders
        onOpenChange(next);
        if (!next) setState({ step: "idle" });
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" aria-hidden="true" /> Print map
          </DialogTitle>
          <DialogDescription>Choose a layout and paper size. Prints can take up to a minute.</DialogDescription>
        </DialogHeader>

        {loadError ? (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {loadError}
          </p>
        ) : !options ? (
          <p className="flex items-center gap-2 py-6 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading layouts…
          </p>
        ) : (
          <div className="space-y-5">
            <fieldset className="space-y-2" disabled={printing}>
              <legend className="mb-2 text-sm font-medium text-text-primary">Layout</legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Layout">
                {options.layouts.map((l) => {
                  const loaded = previews[orientation];
                  const preview = loaded?.[l.id];
                  const o = l.orientation ?? orientation;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      role="radio"
                      aria-checked={layoutId === l.id}
                      onClick={() => {
                        setLayoutId(l.id);
                        if (l.orientation) setOrientation(l.orientation);
                      }}
                      className={cn(
                        "group flex flex-col gap-2 rounded-lg border p-2 text-left text-sm transition-colors",
                        layoutId === l.id
                          ? "border-brand bg-brand-subtle ring-1 ring-brand"
                          : "border-border hover:border-border-strong hover:bg-surface-page"
                      )}
                    >
                      <div className="flex aspect-[4/3] items-center justify-center rounded bg-surface-page p-2">
                        <LayoutWireframe
                          aspect={preview?.aspect ?? LETTER_ASPECT[o]}
                          items={preview ? preview.items : loaded ? [] : null}
                          className={o === "portrait" ? "h-full w-auto" : "max-h-full"}
                        />
                      </div>
                      <span className="px-1 font-medium leading-tight text-text-primary">{l.name}</span>
                      {(l.isDefault || l.assigned || l.branded) && (
                        <span className="flex flex-wrap gap-1 px-1">
                          {l.isDefault && <Badge variant="default">Default</Badge>}
                          {l.assigned && !l.isDefault && <Badge variant="brand">Your organization</Badge>}
                          {l.branded && !l.assigned && <Badge variant="brand">RippleMap</Badge>}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="print-title">Title on the print</Label>
                <Input
                  id="print-title"
                  value={printTitle}
                  maxLength={200}
                  disabled={printing}
                  onChange={(e) => {
                    setPrintTitle(e.target.value);
                    if (!fileNameEdited) setFileName(e.target.value);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="print-file-name">File name</Label>
                <Input
                  id="print-file-name"
                  value={fileName}
                  maxLength={120}
                  disabled={printing}
                  onChange={(e) => {
                    setFileName(e.target.value);
                    setFileNameEdited(true);
                  }}
                />
              </div>
              <p className="-mt-2 text-xs text-text-muted sm:col-span-2">
                The title appears where the layout shows the map&apos;s title.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="print-size">Paper</Label>
                <Select value={size} onValueChange={(v) => setSize(v as typeof size)} disabled={printing}>
                  <SelectTrigger id="print-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="print-orientation">Orientation</Label>
                <Select value={orientation} onValueChange={(v) => setOrientation(v as typeof orientation)} disabled={printing}>
                  <SelectTrigger id="print-orientation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="landscape">Landscape</SelectItem>
                    <SelectItem value="portrait">Portrait</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="print-format">File type</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as typeof format)} disabled={printing}>
                  <SelectTrigger id="print-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="png">PNG image</SelectItem>
                    <SelectItem value="jpg">JPG image (smaller)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="print-dpi">Quality</Label>
                <Select value={String(dpi)} onValueChange={(v) => setDpi(Number(v) as typeof dpi)} disabled={printing}>
                  <SelectTrigger id="print-dpi">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="300">High (300 dpi, for printing)</SelectItem>
                    <SelectItem value="150">Standard (150 dpi, faster)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="print-view">Map area</Label>
                <Select value={view} onValueChange={(v) => setView(v as typeof view)} disabled={printing}>
                  <SelectTrigger id="print-view">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">What I&apos;m looking at now (area and layers shown)</SelectItem>
                    <SelectItem value="saved">The map&apos;s default view</SelectItem>
                  </SelectContent>
                </Select>
                {view === "current" && viewState && viewState.filters.length > 0 && (
                  <p className="flex items-start gap-1.5 rounded-md bg-surface-page p-2 text-xs text-text-secondary">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Your filters will be included. Filtered prints take longer, up to two minutes.
                  </p>
                )}
                {view === "current" && viewState?.hiddenCategory && (
                  <p className="flex items-start gap-1.5 rounded-md bg-[var(--warning-subtle)] p-2 text-xs text-text-secondary">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Categories you&apos;ve switched off in the legend may still appear in the print. To leave them out
                    for sure, use the legend&apos;s filters instead.
                  </p>
                )}
              </div>
            </div>

            {state.step === "error" && (
              <p className="flex items-start gap-2 text-sm text-[var(--danger)]" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {state.message}
              </p>
            )}
            {state.step === "done" && (
              <p className="flex flex-wrap items-center gap-2 text-sm text-text-secondary" role="status">
                <CheckCircle2 className="h-4 w-4 text-[var(--success)]" aria-hidden="true" />
                Your print is downloading.
                <a href={state.url} download={state.filename} className="font-medium">
                  Download again
                </a>
                <span className="text-xs text-text-muted">(link works for a limited time)</span>
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={printLayout} disabled={printing || !layoutId} className="gap-1.5">
                {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                {printing ? `Preparing ${state.label}…` : "Print"}
              </Button>
              {printing && (
                <span className="text-xs text-text-muted">
                  Building your print… This can take {viewState?.filters.length ? "up to two minutes" : "up to a minute"}.
                </span>
              )}
            </div>

            {options.pages.length > 0 && (
              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-sm font-medium text-text-primary">Pages designed for this map</p>
                <p className="text-xs text-text-muted">Ready-made pages your team set up in Felt, printed exactly as designed.</p>
                <ul className="divide-y divide-border rounded-md border border-border">
                  {options.pages.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <FileText className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                      <span className="text-xs uppercase text-text-muted">
                        {p.size} · {p.format}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        disabled={printing}
                        onClick={() => request({ kind: "PAGE", pageId: p.id }, p.name)}
                      >
                        <Download className="h-3.5 w-3.5" /> Download
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
