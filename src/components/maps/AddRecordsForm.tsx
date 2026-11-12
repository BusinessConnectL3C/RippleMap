"use client";

import { useEffect, useState } from "react";
import { Loader2, MapPin, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IconButton } from "@/components/ui/icon-button";

type FieldType = "INTEGER" | "REAL" | "TEXT" | "BOOLEAN" | "DATE" | "DATETIME";

interface AppendableLayer {
  uploadId: string;
  layerName: string;
  fileExt: string;
  fields: { name: string; type: FieldType }[];
}

interface DraftRecord {
  latitude: number;
  longitude: number;
  values: Record<string, string | boolean | null>;
}

/** Window events shared with FeltMapEmbed: ask the map for a click, and get the clicked point back. */
export const PICK_LOCATION_EVENT = "rm:pick-location";
export const LOCATION_PICKED_EVENT = "rm:location-picked";
export const CANCEL_PICK_EVENT = "rm:cancel-pick";

const MAX_RECORDS = 50;

function parseCoord(value: string, limit: number): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

interface Props {
  base: string;
  busy: boolean;
  onSave: (body: Record<string, unknown>, layerName: string, count: number) => Promise<void>;
}

export function AddRecordsForm({ base, busy, onSave }: Props) {
  const [layers, setLayers] = useState<AppendableLayer[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [layerId, setLayerId] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [pending, setPending] = useState<DraftRecord[]>([]);
  const [picking, setPicking] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${base}?for=records`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Couldn't load this map's layers.");
        if (!cancelled) {
          setLayers(data.layers);
          if (data.layers.length === 1) setLayerId(data.layers[0].uploadId);
        }
      })
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : "Couldn't load this map's layers."));
    return () => {
      cancelled = true;
    };
  }, [base]);

  useEffect(() => {
    const onPicked = (e: Event) => {
      const { latitude, longitude } = (e as CustomEvent<{ latitude: number; longitude: number }>).detail;
      setLat(latitude.toFixed(6));
      setLng(longitude.toFixed(6));
      setPicking(false);
    };
    const onCancel = () => setPicking(false);
    window.addEventListener(LOCATION_PICKED_EVENT, onPicked);
    window.addEventListener(CANCEL_PICK_EVENT, onCancel);
    return () => {
      window.removeEventListener(LOCATION_PICKED_EVENT, onPicked);
      window.removeEventListener(CANCEL_PICK_EVENT, onCancel);
      window.dispatchEvent(new Event(CANCEL_PICK_EVENT));
    };
  }, []);

  const layer = layers?.find((l) => l.uploadId === layerId) ?? null;
  const latitude = parseCoord(lat, 90);
  const longitude = parseCoord(lng, 180);
  const currentValid = latitude !== null && longitude !== null;
  const hasCurrentInput = !!lat.trim() || !!lng.trim() || Object.values(values).some((v) => v !== "" && v !== false);

  function currentRecord(): DraftRecord | null {
    if (!layer || latitude === null || longitude === null) return null;
    const vals: DraftRecord["values"] = {};
    for (const f of layer.fields) {
      const v = values[f.name];
      vals[f.name] = f.type === "BOOLEAN" ? !!v : typeof v === "string" && v.trim() ? v.trim() : null;
    }
    return { latitude, longitude, values: vals };
  }

  function clearCurrent() {
    setLat("");
    setLng("");
    setValues({});
  }

  function addToList() {
    const rec = currentRecord();
    if (!rec) return;
    setPending((p) => [...p, rec]);
    clearCurrent();
  }

  function pickOnMap() {
    setPicking(true);
    window.dispatchEvent(new Event(PICK_LOCATION_EVENT));
  }

  const toSave = [...pending, ...(currentValid && layer ? [currentRecord()!] : [])];

  async function save() {
    if (!layer || toSave.length === 0 || !confirmed) return;
    await onSave(
      { kind: "RECORDS", originUploadId: layer.uploadId, records: toSave, confirmed },
      layer.layerName,
      toSave.length
    );
  }

  if (loadError) {
    return (
      <p className="text-sm text-[var(--danger)]" role="alert">
        {loadError}
      </p>
    );
  }
  if (layers === null) {
    return (
      <p className="flex items-center gap-2 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading layers…
      </p>
    );
  }
  if (layers.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        No layers on this map can take new records yet. Records can be added to point layers created here from a CSV
        or GeoJSON upload. Upload one with <strong>Upload a file</strong> first.
      </p>
    );
  }

  const label = (f: { name: string }) => f.name.replace(/_/g, " ");
  const firstText = layer?.fields.find((f) => f.type === "TEXT")?.name;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 @xl:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="records-layer">Layer</Label>
          <Select
            value={layerId}
            disabled={busy || pending.length > 0}
            onValueChange={(id) => {
              setLayerId(id);
              setValues({});
            }}
          >
            <SelectTrigger id="records-layer">
              <SelectValue placeholder="Choose a layer" />
            </SelectTrigger>
            <SelectContent>
              {layers.map((l) => (
                <SelectItem key={l.uploadId} value={l.uploadId}>
                  {l.layerName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 @xl:col-span-2">
          <Label htmlFor="records-lat">Location *</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="records-lat"
              inputMode="decimal"
              placeholder="Latitude"
              value={lat}
              disabled={busy || !layer}
              onChange={(e) => setLat(e.target.value)}
              className="w-36"
              aria-invalid={lat.trim() && latitude === null ? true : undefined}
            />
            <Input
              aria-label="Longitude"
              inputMode="decimal"
              placeholder="Longitude"
              value={lng}
              disabled={busy || !layer}
              onChange={(e) => setLng(e.target.value)}
              className="w-36"
              aria-invalid={lng.trim() && longitude === null ? true : undefined}
            />
            <Button
              type="button"
              variant={picking ? "default" : "outline"}
              size="sm"
              className="h-10 gap-1.5"
              disabled={busy || !layer}
              onClick={picking ? () => window.dispatchEvent(new Event(CANCEL_PICK_EVENT)) : pickOnMap}
            >
              <MapPin className="h-3.5 w-3.5" />
              {picking ? "Click the map… (cancel)" : "Pick on map"}
            </Button>
          </div>
        </div>
      </div>

      {layer && layer.fields.length > 0 && (
        <div className="grid gap-4 @sm:grid-cols-2 @3xl:grid-cols-3">
          {layer.fields.map((f) => {
            const id = `records-field-${f.name}`;
            if (f.type === "BOOLEAN") {
              return (
                <label key={f.name} className="flex items-center gap-2 pt-6 text-sm text-text-primary">
                  <input
                    id={id}
                    type="checkbox"
                    checked={values[f.name] === true}
                    disabled={busy}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.checked }))}
                  />
                  {label(f)}
                </label>
              );
            }
            return (
              <div key={f.name} className="space-y-1.5">
                <Label htmlFor={id}>{label(f)}</Label>
                <Input
                  id={id}
                  type={f.type === "DATE" ? "date" : f.type === "DATETIME" ? "datetime-local" : f.type === "TEXT" ? "text" : "number"}
                  step={f.type === "REAL" ? "any" : f.type === "INTEGER" ? "1" : undefined}
                  value={typeof values[f.name] === "string" ? (values[f.name] as string) : ""}
                  disabled={busy}
                  maxLength={2000}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={busy || !currentValid || pending.length >= MAX_RECORDS - 1}
          onClick={addToList}
        >
          <Plus className="h-3.5 w-3.5" /> Add another record
        </Button>
        {hasCurrentInput && !currentValid && (
          <span className="text-xs text-text-muted">Each record needs a location: type it or pick it on the map.</span>
        )}
      </div>

      {pending.length > 0 && (
        <div className="rounded-md border border-border">
          <p className="border-b border-border px-3 py-2 text-xs font-medium text-text-secondary">
            Ready to save ({pending.length})
          </p>
          <ul className="divide-y divide-border">
            {pending.map((r, i) => (
              <li key={i} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {(firstText && (r.values[firstText] as string)) || `Record ${i + 1}`}
                </span>
                <span className="font-mono text-xs text-text-muted">
                  {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                </span>
                <IconButton
                  label="Remove from list"
                  variant="ghost"
                  className="h-7 w-7"
                  disabled={busy}
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="flex items-start gap-2 text-sm text-text-secondary">
        <input
          type="checkbox"
          className="mt-1"
          checked={confirmed}
          disabled={busy}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>
          These records contain no personal or sensitive information, such as people&apos;s names with home addresses,
          health, financial or ID details. They will be stored with our mapping provider, Felt.
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={busy || !layer || !confirmed || toSave.length === 0}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {busy ? "Saving…" : toSave.length > 1 ? `Save ${toSave.length} records` : "Save record"}
        </Button>
        <span className="text-xs text-text-muted">
          Saving updates the whole layer in Felt and takes about a minute. Avoid editing this layer in Felt meanwhile.
        </span>
      </div>
    </div>
  );
}
