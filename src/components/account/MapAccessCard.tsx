"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, ChevronRight, Copy, Globe, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

type Visibility = "RESTRICTED" | "ALL_MEMBERS" | "PUBLIC";

interface MemberOption {
  id: string;
  name: string;
  email: string;
}

interface MapAccessRow {
  id: string;
  feltMapId: string;
  title: string;
  kindLabel: string;
  visibility: Visibility;
  madePublicInFelt: boolean;
  grants: Array<{ userId: string; canExport: boolean }>;
}

interface Props {
  maps: MapAccessRow[];
  /** Members with the MEMBER role. Owners and admins always see every map. */
  members: MemberOption[];
  /** The org has a Felt project, so "Check Felt for new maps" can run. */
  canSync: boolean;
}

const VISIBILITY_LABEL: Record<Visibility, string> = {
  RESTRICTED: "Restricted",
  ALL_MEMBERS: "All members",
  PUBLIC: "Public",
};

async function copyText(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast({ variant: "success", title: `${what} copied` });
  } catch {
    toast({ variant: "danger", title: "Couldn't copy", description: "Select the text and copy it manually." });
  }
}

function PublicShare({ feltMapId }: { feltMapId: string }) {
  const link = `https://felt.com/map/${feltMapId}`;
  const embed = `<iframe src="https://felt.com/embed/map/${feltMapId}" width="100%" height="600" style="border:0" title="Map" allowfullscreen></iframe>`;
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-text-secondary w-20">Public link</span>
        <code className="min-w-0 flex-1 truncate rounded bg-surface-page px-2 py-1 text-xs">{link}</code>
        <Button variant="ghost" size="sm" onClick={() => copyText(link, "Link")} aria-label="Copy public link">
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-text-secondary w-20">Embed code</span>
        <code className="min-w-0 flex-1 truncate rounded bg-surface-page px-2 py-1 text-xs">{embed}</code>
        <Button variant="ghost" size="sm" onClick={() => copyText(embed, "Embed code")} aria-label="Copy embed code">
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
      <p className="text-xs text-text-muted">
        Anyone with the link can view this map without signing in. Data export stays off. Every view counts toward
        your map-view allowance.
      </p>
    </div>
  );
}

/**
 * Org OWNER/ADMIN control over who sees each map. Restricted and All members
 * are RippleMap-only; Public also switches on the map's public link in Felt.
 */
export function MapAccessCard({ maps, members, canSync }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmPublic, setConfirmPublic] = useState<string | null>(null);

  async function send(key: string, url: string, method: "PATCH" | "PUT" | "DELETE" | "POST", body?: unknown) {
    setBusy(key);
    try {
      const res = await fetch(url, {
        method,
        headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast({ variant: "danger", title: "Could not update", description: data?.error ?? "Please try again." });
        return null;
      }
      router.refresh();
      return data;
    } finally {
      setBusy(null);
    }
  }

  function changeVisibility(map: MapAccessRow, visibility: Visibility) {
    if (visibility === "PUBLIC") {
      setConfirmPublic(map.id);
      return;
    }
    send(map.id, `/api/account/maps/${map.id}`, "PATCH", { visibility });
  }

  async function syncNow() {
    const data = await send("sync", "/api/account/maps/sync", "POST");
    if (!data) return;
    const parts: string[] = [];
    if (data.added) parts.push(`${data.added} new map${data.added === 1 ? "" : "s"} added as Restricted`);
    if (data.madePublic) parts.push(`${data.madePublic} made public in Felt`);
    if (data.madePrivate) parts.push(`${data.madePrivate} made private in Felt`);
    toast({ variant: "success", title: parts.length ? parts.join(", ") : "Everything is up to date" });
  }

  const flagged = maps.filter((m) => m.madePublicInFelt);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle>Map Access</CardTitle>
        {canSync && (
          <Button variant="outline" size="sm" onClick={syncNow} disabled={busy === "sync"} className="gap-1.5">
            {busy === "sync" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Check Felt for new maps
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-text-muted">
          Owners and admins see every map. New maps are <strong>Restricted</strong> until you share them with
          everyone, with specific members, or publicly. Maps your Field Editor creates in Felt appear here
          automatically. Removing access applies to new page loads; a map someone already has open can stay visible
          to them for up to 12 hours.
        </p>

        {flagged.length > 0 && (
          <div className="flex gap-2 rounded-md border border-[var(--warning)] bg-[var(--warning-subtle)] p-3 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--yellow-500)]" aria-hidden="true" />
            <p>
              {flagged.length === 1 ? "1 map was" : `${flagged.length} maps were`} made public directly in Felt. Anyone
              with the link can view {flagged.length === 1 ? "it" : "them"}. Review below: keep public, or make
              private.
            </p>
          </div>
        )}

        {maps.length === 0 ? (
          <p className="text-sm text-text-secondary">No maps yet. BC will add your organization&apos;s maps here.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {maps.map((map) => {
              const isOpen = open === map.id;
              const grantsByUser = new Map(map.grants.map((g) => [g.userId, g]));
              const expandable = map.visibility !== "ALL_MEMBERS";
              return (
                <li key={map.id}>
                  <div className="flex flex-wrap items-center gap-3 px-3 py-2">
                    <button
                      type="button"
                      className="flex flex-1 min-w-0 items-center gap-2 text-left"
                      onClick={() => setOpen(isOpen ? null : map.id)}
                      aria-expanded={isOpen}
                      disabled={!expandable}
                    >
                      {expandable ? (
                        isOpen ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
                        )
                      ) : (
                        <span className="w-4" />
                      )}
                      <span className="truncate font-medium text-text-primary">{map.title}</span>
                      <Badge variant="secondary">{map.kindLabel}</Badge>
                      {map.visibility === "PUBLIC" && (
                        <Badge variant={map.madePublicInFelt ? "warning" : "info"}>
                          <Globe className="h-3 w-3" /> {map.madePublicInFelt ? "Public in Felt: review" : "Public"}
                        </Badge>
                      )}
                      {map.visibility === "RESTRICTED" && (
                        <span className="text-xs text-text-muted">
                          {map.grants.length} member{map.grants.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </button>
                    <div className="flex items-center gap-2">
                      {busy === map.id && <Loader2 className="h-3 w-3 animate-spin text-text-muted" />}
                      <Select
                        value={map.visibility}
                        disabled={busy === map.id}
                        onValueChange={(v) => changeVisibility(map, v as Visibility)}
                      >
                        <SelectTrigger className="h-8 w-40 text-xs" aria-label={`Who can see ${map.title}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(VISIBILITY_LABEL) as Visibility[]).map((v) => (
                            <SelectItem key={v} value={v}>
                              {VISIBILITY_LABEL[v]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {confirmPublic === map.id && (
                    <div className="border-t border-border bg-[var(--warning-subtle)] px-3 py-3 space-y-2 text-sm" role="alertdialog" aria-label={`Make ${map.title} public?`}>
                      <p className="font-medium text-text-primary">Make &ldquo;{map.title}&rdquo; public?</p>
                      <p className="text-text-secondary">
                        Anyone with the link will be able to view this map and its data on screen, without signing in.
                        Only do this for information your organization is happy to publish.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={busy === map.id}
                          onClick={async () => {
                            const ok = await send(map.id, `/api/account/maps/${map.id}`, "PATCH", { visibility: "PUBLIC" });
                            if (ok) {
                              setConfirmPublic(null);
                              setOpen(map.id);
                            }
                          }}
                        >
                          Make public
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setConfirmPublic(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {map.madePublicInFelt && (
                    <div className="border-t border-border px-3 py-2 flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-text-secondary">Someone made this map public in Felt.</span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === map.id}
                        onClick={() => send(map.id, `/api/account/maps/${map.id}`, "PATCH", { approvePublic: true })}
                      >
                        Keep public
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === map.id}
                        onClick={() => send(map.id, `/api/account/maps/${map.id}`, "PATCH", { visibility: "RESTRICTED" })}
                      >
                        Make private
                      </Button>
                    </div>
                  )}

                  {isOpen && map.visibility === "PUBLIC" && (
                    <div className="border-t border-border bg-surface-page px-3 py-3">
                      <PublicShare feltMapId={map.feltMapId} />
                    </div>
                  )}

                  {isOpen && map.visibility === "RESTRICTED" && (
                    <div className="border-t border-border bg-surface-page px-3 py-2">
                      {members.length === 0 ? (
                        <p className="text-sm text-text-secondary">
                          No members to share with: everyone in your organization is an owner or admin.
                        </p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-text-muted">
                              <th className="py-1 font-medium">Member</th>
                              <th className="py-1 font-medium w-20 text-center">Can view</th>
                              <th className="py-1 font-medium w-24 text-center">Can export</th>
                            </tr>
                          </thead>
                          <tbody>
                            {members.map((member) => {
                              const grant = grantsByUser.get(member.id);
                              const key = `${map.id}:${member.id}`;
                              const url = `/api/account/maps/${map.id}/grants`;
                              return (
                                <tr key={member.id}>
                                  <td className="py-1">
                                    <span className="text-text-primary">{member.name}</span>{" "}
                                    <span className="text-xs text-text-muted">{member.email}</span>
                                  </td>
                                  <td className="py-1 text-center">
                                    <Checkbox
                                      checked={!!grant}
                                      disabled={busy === key}
                                      aria-label={`${member.name} can view ${map.title}`}
                                      onCheckedChange={(checked) =>
                                        checked
                                          ? send(key, url, "PUT", { userId: member.id, canExport: false })
                                          : send(key, url, "DELETE", { userId: member.id })
                                      }
                                    />
                                  </td>
                                  <td className="py-1 text-center">
                                    <Checkbox
                                      checked={!!grant?.canExport}
                                      disabled={!grant || busy === key}
                                      aria-label={`${member.name} can export data from ${map.title}`}
                                      onCheckedChange={(checked) =>
                                        send(key, url, "PUT", { userId: member.id, canExport: checked === true })
                                      }
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
