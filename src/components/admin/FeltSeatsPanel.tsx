"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, ExternalLink, Loader2, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

interface SeatHolder {
  id: string;
  name: string;
  /** Email to invite in Felt: feltEmail if set, else their RippleMap email. */
  inviteEmail: string;
  hasCustomFeltEmail: boolean;
  access: "EDIT" | "CONTRIBUTE";
  accepted: boolean;
}

interface Props {
  workspace: { used: number; limit: number };
  org: { used: number; included: number | null };
  projectName: string | null;
  holders: SeatHolder[];
}

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast({ variant: "success", title: `${what} copied` });
  } catch {
    toast({ variant: "danger", title: "Couldn't copy", description: "Select the text and copy it manually." });
  }
}

/**
 * Seat counter + the manual Felt invite hand-off. Felt has no members API, so
 * BC staff send the invite in Felt; this panel gives them exactly what to
 * paste, and records when the person has accepted.
 */
export function FeltSeatsPanel({ workspace, org, projectName, holders }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState("");

  async function patchUser(id: string, body: unknown, success: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast({ variant: "danger", title: "Could not save", description: data?.error ?? "Please try again." });
        return false;
      }
      toast({ variant: "success", title: success });
      router.refresh();
      return true;
    } finally {
      setBusy(null);
    }
  }

  const workspaceFull = workspace.used >= workspace.limit;
  const orgOver = org.included !== null && org.used > org.included;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-gray-200 p-3">
          <p className="text-xs text-gray-600">Felt workspace seats</p>
          <p className={`font-display text-2xl font-bold tabular-nums ${workspaceFull ? "text-red-700" : "text-gray-900"}`}>
            {workspace.used} <span className="text-base font-medium text-gray-500">of {workspace.limit} used</span>
          </p>
          <p className="text-xs text-gray-600">Counts everyone marked with a Felt seat in RippleMap, including RM Staff.</p>
        </div>
        <div className="rounded-md border border-gray-200 p-3">
          <p className="text-xs text-gray-600">This organization</p>
          <p className={`font-display text-2xl font-bold tabular-nums ${orgOver ? "text-red-700" : "text-gray-900"}`}>
            {org.used}{" "}
            <span className="text-base font-medium text-gray-500">
              {org.included !== null ? `of ${org.included} included` : "in use"}
            </span>
          </p>
          <p className="text-xs text-gray-600">
            {org.included !== null ? "Included seats come from the Billing card." : "Set included seats in the Billing card."}
          </p>
        </div>
      </div>

      {holders.length === 0 ? (
        <p className="text-sm text-gray-600">
          No Field Editor yet. Choose one in the Users table below (Felt seat column), then send their invite from here.
        </p>
      ) : (
        <ul className="space-y-3">
          {holders.map((h) => (
            <li key={h.id} className="rounded-md border border-gray-200 p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-gray-900">{h.name}</span>
                <Badge variant="secondary">Field Editor: {h.access === "EDIT" ? "Edit" : "Contribute"}</Badge>
                {h.accepted ? (
                  <Badge variant="success">
                    <CheckCircle2 className="h-3 w-3" /> Invite accepted
                  </Badge>
                ) : (
                  <Badge variant="warning">
                    <Mail className="h-3 w-3" /> Invite pending
                  </Badge>
                )}
              </div>

              {!h.accepted && (
                <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
                  <li>
                    <a
                      href="https://felt.com"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-link hover:underline"
                    >
                      Open Felt <ExternalLink className="h-3 w-3" />
                    </a>{" "}
                    and go to the project
                    {projectName ? (
                      <>
                        {" "}
                        <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{projectName}</code>
                        <button
                          type="button"
                          className="ml-1 inline-flex align-middle text-gray-500 hover:text-gray-800"
                          aria-label="Copy project name"
                          onClick={() => copy(projectName, "Project name")}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      " for this org (create it in the Felt Maps card first)"
                    )}
                    . Invite to the project, not the workspace, so they only see this org&apos;s maps.
                  </li>
                  <li>
                    Click <strong>Share</strong>, enter{" "}
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{h.inviteEmail}</code>
                    <button
                      type="button"
                      className="ml-1 inline-flex align-middle text-gray-500 hover:text-gray-800"
                      aria-label="Copy email"
                      onClick={() => copy(h.inviteEmail, "Email")}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    , choose <strong>{h.access === "EDIT" ? "Edit" : "Contribute"}</strong>, and send the invite. This
                    uses one Felt seat.
                  </li>
                  <li>When they&apos;ve accepted Felt&apos;s email, mark it below.</li>
                </ol>
              )}

              {editingEmail === h.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id={`felt-email-${h.id}`}
                    type="email"
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                    className="h-8 max-w-xs text-sm"
                    aria-label={`Felt email for ${h.name}`}
                    placeholder="Email they use for Felt"
                  />
                  <Button
                    size="sm"
                    disabled={busy === h.id}
                    onClick={async () => {
                      const ok = await patchUser(h.id, { feltEmail: emailDraft.trim() || null }, "Felt email saved");
                      if (ok) setEditingEmail(null);
                    }}
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingEmail(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {!h.accepted ? (
                    <Button
                      size="sm"
                      disabled={busy === h.id}
                      onClick={() => patchUser(h.id, { feltInviteAccepted: true }, "Marked as accepted")}
                    >
                      {busy === h.id && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                      Mark invite accepted
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === h.id}
                      onClick={() => patchUser(h.id, { feltInviteAccepted: false }, "Marked as pending")}
                    >
                      Mark as pending again
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEmailDraft(h.hasCustomFeltEmail ? h.inviteEmail : "");
                      setEditingEmail(h.id);
                    }}
                  >
                    {h.hasCustomFeltEmail ? "Change Felt email" : "Uses a different email for Felt?"}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
