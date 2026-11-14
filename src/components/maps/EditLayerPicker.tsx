"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataEditorDialog } from "@/components/maps/DataEditorDialog";

interface EditableLayer {
  uploadId: string;
  layerName: string;
}

/** Add data → Edit data: pick a portal-uploaded layer and open it in the data editor. */
export function EditLayerPicker({ base }: { base: string }) {
  const router = useRouter();
  const [layers, setLayers] = useState<EditableLayer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [editing, setEditing] = useState<EditableLayer | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${base}?for=edit`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? "Couldn't load this map's layers.");
        if (cancelled) return;
        setLayers(json.layers);
        if (json.layers.length === 1) setSelected(json.layers[0].uploadId);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Couldn't load this map's layers."));
    return () => {
      cancelled = true;
    };
  }, [base]);

  if (error) return <p className="text-sm text-[var(--danger)]" role="alert">{error}</p>;
  if (!layers) {
    return (
      <p className="flex items-center gap-2 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading layers…
      </p>
    );
  }
  if (layers.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        No layers on this map can be edited here yet. Layers created here from a CSV or GeoJSON upload can be edited;
        layers built in Felt, or that collect field data, are edited in Felt.
      </p>
    );
  }

  const layer = layers.find((l) => l.uploadId === selected) ?? null;

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary">
        Change values, delete records or add columns in a table, then save once. The map updates in about a minute.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="edit-layer">Layer</Label>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger id="edit-layer">
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
      <Button className="gap-1.5" disabled={!layer} onClick={() => layer && setEditing(layer)}>
        <Table2 className="h-4 w-4" /> Open editor
      </Button>
      {savedName && <p className="text-sm text-[var(--success)]">{savedName} was updated.</p>}
      <DataEditorDialog
        base={base}
        layer={editing}
        onClose={() => setEditing(null)}
        onSaved={(name) => {
          setSavedName(name);
          router.refresh();
        }}
      />
    </div>
  );
}
