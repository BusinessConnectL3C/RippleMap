"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, ImageIcon, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

type Kind = "MAP" | "DASHBOARD" | "SURVEY";
type Visibility = "RESTRICTED" | "ALL_MEMBERS" | "PUBLIC";

interface MapRow {
  id: string;
  feltMapId: string;
  title: string;
  kind: Kind;
  visibility: Visibility;
  grantCount: number;
  hasThumbnail: boolean;
  madePublicInFelt: boolean;
  isTemplate: boolean;
  templateDescription: string | null;
}

interface Props {
  orgId: string;
  feltProjectId: string | null;
  feltConfigured: boolean;
  maps: MapRow[];
  /** BC staff org: its maps can be offered to clients as templates. */
  isInternalOrg?: boolean;
}

function TemplateControls({
  map,
  busy,
  onSave,
}: {
  map: MapRow;
  busy: boolean;
  onSave: (body: { isTemplate?: boolean; templateDescription?: string | null }, label: string) => void;
}) {
  const [description, setDescription] = useState(map.templateDescription ?? "");
  return (
    <div className="mt-2 space-y-1">
      <label className="flex items-center gap-2 text-xs text-gray-700">
        <input
          type="checkbox"
          checked={map.isTemplate}
          disabled={busy}
          onChange={(e) =>
            onSave({ isTemplate: e.target.checked }, e.target.checked ? "Offered as a template" : "Removed from templates")
          }
        />
        Offer to clients as a template
      </label>
      {map.isTemplate && (
        <div className="flex gap-1">
          <Input
            id={`template-desc-${map.id}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description clients see"
            className="h-7 text-xs"
            maxLength={300}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={busy || description === (map.templateDescription ?? "")}
            onClick={() => onSave({ templateDescription: description.trim() || null }, "Description saved")}
          >
            Save
          </Button>
        </div>
      )}
    </div>
  );
}

const KIND_LABEL: Record<Kind, string> = { MAP: "Map", DASHBOARD: "Dashboard", SURVEY: "Survey" };

async function errorMessage(res: Response) {
  const data = await res.json().catch(() => null);
  return data?.error ?? "Please try again.";
}

export function FeltMapsPanel({ orgId, feltProjectId, feltConfigured, maps, isInternalOrg = false }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [mapInput, setMapInput] = useState("");
  const [newKind, setNewKind] = useState<Kind>("MAP");
  const [templateTitle, setTemplateTitle] = useState("");

  async function run(key: string, fn: () => Promise<Response>, success: (res: Response) => Promise<string>) {
    setBusy(key);
    try {
      const res = await fn();
      if (!res.ok) {
        toast({ variant: "danger", title: "Felt request failed", description: await errorMessage(res) });
        return false;
      }
      toast({ variant: "success", title: await success(res) });
      router.refresh();
      return true;
    } finally {
      setBusy(null);
    }
  }

  const post = (body: unknown) =>
    fetch(`/api/admin/organizations/${orgId}/felt-maps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  const patchMap = (id: string, body: unknown) =>
    fetch(`/api/admin/felt-maps/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  if (!feltConfigured) {
    return <p className="text-sm text-gray-600">Felt isn&apos;t configured: set <code>FELT_API_TOKEN</code> to manage maps.</p>;
  }

  if (!feltProjectId) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          This org has no Felt project yet (creation at registration may have failed).
        </p>
        <Button
          disabled={busy === "project"}
          onClick={() =>
            run(
              "project",
              () => fetch(`/api/admin/organizations/${orgId}/felt-project`, { method: "POST" }),
              async () => "Felt project ready"
            )
          }
        >
          {busy === "project" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Create private Felt project
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-600">
        Felt project <code className="font-mono">{feltProjectId}</code>. Maps registered here are visible in the
        portal; new maps are <strong>Restricted</strong> (org owners/admins only) until access is granted. Private
        maps get viewer export turned off in Felt. A map already public in Felt stays public and is flagged for review.
        New maps are also picked up automatically when the org&apos;s owners or admins open their map pages.
      </p>

      {maps.length === 0 ? (
        <p className="text-sm text-gray-600">No maps registered yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-3 py-2 text-left font-medium text-gray-700">Map</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Type</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Visible to</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {maps.map((m) => (
              <tr key={m.id}>
                <td className="px-3 py-2">
                  <a href={`/maps/f/${m.feltMapId}`} className="font-medium text-gray-900 hover:underline">
                    {m.title}
                  </a>{" "}
                  <a
                    href={`https://felt.com/map/${m.feltMapId}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${m.title} in Felt`}
                    className="inline-flex text-gray-500 hover:text-gray-800"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  {m.isTemplate && (
                    <Badge variant="info" className="ml-2">
                      Template
                    </Badge>
                  )}
                  {isInternalOrg && (
                    <TemplateControls
                      map={m}
                      busy={busy === m.id}
                      onSave={(body, label) => run(m.id, () => patchMap(m.id, body), async () => label)}
                    />
                  )}
                </td>
                <td className="px-3 py-2">
                  <Select
                    value={m.kind}
                    disabled={busy === m.id}
                    onValueChange={(kind) =>
                      run(m.id, () => patchMap(m.id, { kind }), async () => "Map type updated")
                    }
                  >
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {KIND_LABEL[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Select
                    value={m.visibility}
                    disabled={busy === m.id}
                    onValueChange={(visibility) => {
                      if (
                        visibility === "PUBLIC" &&
                        !confirm(`Make "${m.title}" public? Anyone with the link can view it without signing in.`)
                      ) {
                        return;
                      }
                      run(m.id, () => patchMap(m.id, { visibility }), async () => "Visibility updated");
                    }}
                  >
                    <SelectTrigger className="h-8 w-36 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RESTRICTED">Restricted</SelectItem>
                      <SelectItem value="ALL_MEMBERS">All members</SelectItem>
                      <SelectItem value="PUBLIC">Public</SelectItem>
                    </SelectContent>
                  </Select>
                  {m.madePublicInFelt && (
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                      <Badge variant="warning">Made public in Felt</Badge>
                      <button
                        type="button"
                        className="text-link hover:underline"
                        disabled={busy === m.id}
                        onClick={() => run(m.id, () => patchMap(m.id, { approvePublic: true }), async () => "Kept public")}
                      >
                        Keep
                      </button>
                      <span className="text-gray-400">·</span>
                      <button
                        type="button"
                        className="text-link hover:underline"
                        disabled={busy === m.id}
                        onClick={() =>
                          run(m.id, () => patchMap(m.id, { visibility: "RESTRICTED" }), async () => "Made private")
                        }
                      >
                        Make private
                      </button>
                    </div>
                  )}
                  {m.visibility === "RESTRICTED" && (
                    <Badge variant="secondary" className="ml-2">
                      {m.grantCount} granted
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy === m.id + ":thumb"}
                    aria-label={`${m.hasThumbnail ? "Refresh" : "Create"} thumbnail for ${m.title}`}
                    title={m.hasThumbnail ? "Refresh thumbnail" : "No thumbnail yet: create one"}
                    className={m.hasThumbnail ? "text-gray-500" : "text-amber-600"}
                    onClick={() =>
                      run(
                        m.id + ":thumb",
                        () => fetch(`/api/admin/felt-maps/${m.id}/thumbnail`, { method: "POST" }),
                        async () => "Thumbnail updated"
                      )
                    }
                  >
                    {busy === m.id + ":thumb" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ImageIcon className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy === m.id}
                    aria-label={`Unregister ${m.title}`}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => {
                      if (!confirm(`Remove "${m.title}" from RippleMap? The map stays in Felt; portal access and grants are removed.`)) return;
                      run(m.id, () => fetch(`/api/admin/felt-maps/${m.id}`, { method: "DELETE" }), async () => "Map removed");
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="felt-map-url">Add existing map</Label>
          <Input
            id="felt-map-url"
            value={mapInput}
            onChange={(e) => setMapInput(e.target.value)}
            placeholder="https://felt.com/map/…"
            className="font-mono text-xs"
          />
          <div className="flex gap-2">
            <Select value={newKind} onValueChange={(v) => setNewKind(v as Kind)}>
              <SelectTrigger className="h-9 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              disabled={!mapInput.trim() || busy === "register"}
              onClick={async () => {
                const ok = await run(
                  "register",
                  () => post({ action: "register", map: mapInput.trim(), kind: newKind }),
                  async () => "Map registered"
                );
                if (ok) setMapInput("");
              }}
            >
              {busy === "register" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Register
            </Button>
          </div>
          <p className="text-xs text-gray-600">The map must already be in this org&apos;s Felt project.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="felt-template-title">New map from template</Label>
          <Input
            id="felt-template-title"
            value={templateTitle}
            onChange={(e) => setTemplateTitle(e.target.value)}
            placeholder="Map title"
          />
          <Button
            disabled={!templateTitle.trim() || busy === "template"}
            onClick={async () => {
              const ok = await run(
                "template",
                () => post({ action: "fromTemplate", title: templateTitle.trim(), kind: newKind }),
                async () => "Map created from template"
              );
              if (ok) setTemplateTitle("");
            }}
          >
            {busy === "template" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Create
          </Button>
          <p className="text-xs text-gray-600">Copies FELT_TEMPLATE_MAP_ID into the project (uses the type selected at left).</p>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        disabled={busy === "sync"}
        onClick={() =>
          run("sync", () => post({ action: "sync" }), async (res) => {
            const data = await res.json();
            const parts = [`${data.added} added`];
            if (data.madePublic) parts.push(`${data.madePublic} public in Felt (flagged)`);
            if (data.madePrivate) parts.push(`${data.madePrivate} made private in Felt`);
            if (data.conflicts?.length) parts.push(`${data.conflicts.length} registered to another org`);
            return `Synced: ${parts.join(", ")}`;
          })
        }
      >
        {busy === "sync" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
        Sync from Felt project
      </Button>
    </div>
  );
}
