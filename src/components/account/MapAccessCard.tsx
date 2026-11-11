"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

interface MemberOption {
  id: string;
  name: string;
  email: string;
}

interface MapAccessRow {
  id: string;
  title: string;
  kindLabel: string;
  visibility: "RESTRICTED" | "ALL_MEMBERS";
  grants: Array<{ userId: string; canExport: boolean }>;
}

interface Props {
  maps: MapAccessRow[];
  /** Members with the MEMBER role. Owners and admins always see every map. */
  members: MemberOption[];
}

/**
 * Org OWNER/ADMIN control over who sees each map in the portal. New maps are
 * Restricted (owners/admins only) until shared. This controls RippleMap
 * access only; it never changes sharing in Felt.
 */
export function MapAccessCard({ maps, members }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function send(key: string, url: string, method: "PATCH" | "PUT" | "DELETE", body: unknown) {
    setBusy(key);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast({ variant: "danger", title: "Could not update access", description: data?.error ?? "Please try again." });
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Map Access</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-text-muted">
          Owners and admins see every map. New maps are <strong>Restricted</strong>: share them with everyone, or
          with specific members. Removing access applies to new page loads; a map someone already has open can stay
          visible to them for up to 12 hours.
        </p>

        {maps.length === 0 ? (
          <p className="text-sm text-text-secondary">No maps yet. BC will add your organization&apos;s maps here.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {maps.map((map) => {
              const isOpen = open === map.id;
              const grantsByUser = new Map(map.grants.map((g) => [g.userId, g]));
              return (
                <li key={map.id}>
                  <div className="flex flex-wrap items-center gap-3 px-3 py-2">
                    <button
                      type="button"
                      className="flex flex-1 min-w-0 items-center gap-2 text-left"
                      onClick={() => setOpen(isOpen ? null : map.id)}
                      aria-expanded={isOpen}
                      disabled={map.visibility === "ALL_MEMBERS"}
                    >
                      {map.visibility === "RESTRICTED" ? (
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
                        onValueChange={(visibility) =>
                          send(map.id, `/api/account/maps/${map.id}`, "PATCH", { visibility })
                        }
                      >
                        <SelectTrigger className="h-8 w-44 text-xs" aria-label={`Who can see ${map.title}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="RESTRICTED">Restricted</SelectItem>
                          <SelectItem value="ALL_MEMBERS">All members</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

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
