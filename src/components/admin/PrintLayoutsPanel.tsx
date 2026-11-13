"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LayoutWireframe, type WireframeItem } from "@/components/maps/LayoutWireframe";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Layout {
  id: string;
  name: string;
  kind: "built_in" | "workspace";
  orientation: "portrait" | "landscape" | null;
  shared: boolean;
  missing?: boolean;
  assigned: boolean;
  isDefault: boolean;
}

interface Preview {
  layoutId: string;
  aspect: number;
  items: WireframeItem[];
}

const NONE = "__none__";

/**
 * Staff: which of BC's saved Felt print layouts this org can print with, and
 * which layout is preselected. Built-ins and "RippleMap …" layouts are offered
 * to every org already.
 */
export function PrintLayoutsPanel({ orgId }: { orgId: string }) {
  const [layouts, setLayouts] = useState<Layout[] | null>(null);
  const [mapId, setMapId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, Preview> | null>(null);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [defaultId, setDefaultId] = useState<string>(NONE);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/organizations/${orgId}/print-layouts`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Couldn't load print layouts.");
        if (cancelled) return;
        setLayouts(data.layouts);
        setMapId(data.mapId);
        setAssigned(new Set((data.layouts as Layout[]).filter((l) => l.assigned).map((l) => l.id)));
        setDefaultId((data.layouts as Layout[]).find((l) => l.isDefault)?.id ?? NONE);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Couldn't load print layouts."));
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const assignable = useMemo(() => layouts?.filter((l) => !l.shared) ?? [], [layouts]);
  const shared = useMemo(() => layouts?.filter((l) => l.shared && !l.missing) ?? [], [layouts]);

  useEffect(() => {
    if (!mapId || assignable.length === 0 || previews) return;
    const ids = assignable.filter((l) => !l.missing).map((l) => l.id).join(",");
    fetch(`/api/admin/print-layouts/previews?mapId=${encodeURIComponent(mapId)}&ids=${encodeURIComponent(ids)}&orientation=landscape`)
      .then((res) => (res.ok ? res.json() : { previews: [] }))
      .then((data: { previews: Preview[] }) => setPreviews(Object.fromEntries(data.previews.map((p) => [p.layoutId, p]))))
      .catch(() => setPreviews({}));
  }, [mapId, assignable, previews]);

  function toggle(id: string) {
    const next = new Set(assigned);
    if (next.has(id)) {
      next.delete(id);
      if (defaultId === id) setDefaultId(NONE);
    } else next.add(id);
    setAssigned(next);
    setDirty(true);
  }

  async function save() {
    if (!layouts) return;
    setSaving(true);
    const byId = new Map(layouts.map((l) => [l.id, l]));
    const def = defaultId === NONE ? null : byId.get(defaultId);
    const res = await fetch(`/api/admin/organizations/${orgId}/print-layouts`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assigned: [...assigned].map((id) => ({ id, name: byId.get(id)?.name ?? id })),
        defaultLayout: def ? { id: def.id, name: def.name } : null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast({ variant: "danger", title: "Couldn't save print layouts" });
      return;
    }
    setDirty(false);
    toast({ variant: "success", title: "Print layouts saved" });
  }

  if (error) return <p className="text-sm text-text-secondary">{error}</p>;
  if (!layouts) {
    return (
      <p className="flex items-center gap-2 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading layouts from Felt…
      </p>
    );
  }

  // Default can be any layout the org will have: shared ones plus those assigned.
  const defaultChoices = [...layouts.filter((l) => assigned.has(l.id)), ...shared];

  return (
    <div className="space-y-5">
      <p className="text-sm text-text-secondary">
        Layouts saved in Felt&apos;s print editor (Save as layout) appear here. Tick the ones this organization can print
        with. Felt&apos;s built-in layouts and layouts named &ldquo;RippleMap …&rdquo; are offered to every organization.
      </p>

      {assignable.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-4 text-sm text-text-muted">
          No saved layouts yet. In Felt, design a page in a map&apos;s print editor and choose Save as layout.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {assignable.map((l) => {
            const preview = previews?.[l.id];
            const on = assigned.has(l.id);
            return (
              <label
                key={l.id}
                className={cn(
                  "flex cursor-pointer flex-col gap-2 rounded-lg border p-2 text-sm transition-colors",
                  on ? "border-brand bg-brand-subtle ring-1 ring-brand" : "border-border hover:border-border-strong"
                )}
              >
                <div className="flex aspect-[4/3] items-center justify-center rounded bg-surface-page p-2">
                  {l.missing ? (
                    <span className="flex items-center gap-1.5 text-xs text-text-muted">
                      <AlertTriangle className="h-3.5 w-3.5" /> Deleted in Felt
                    </span>
                  ) : (
                    <LayoutWireframe
                      aspect={preview?.aspect ?? (l.orientation === "portrait" ? 8.5 / 11 : 11 / 8.5)}
                      items={preview ? preview.items : previews ? [] : null}
                      className={l.orientation === "portrait" ? "h-full w-auto" : "max-h-full"}
                    />
                  )}
                </div>
                <span className="flex items-start gap-2 px-1">
                  <input type="checkbox" className="mt-0.5" checked={on} onChange={() => toggle(l.id)} />
                  <span className="font-medium leading-tight text-text-primary">{l.name}</span>
                </span>
                {defaultId === l.id && (
                  <span className="px-1">
                    <Badge variant="default">Default</Badge>
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor={`default-layout-${orgId}`}>Default layout</Label>
          <Select
            value={defaultId}
            onValueChange={(v) => {
              setDefaultId(v);
              setDirty(true);
            }}
          >
            <SelectTrigger id={`default-layout-${orgId}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None (first in the list)</SelectItem>
              {defaultChoices.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                  {l.kind === "built_in" ? " (Felt)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={save} disabled={saving || !dirty}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}
