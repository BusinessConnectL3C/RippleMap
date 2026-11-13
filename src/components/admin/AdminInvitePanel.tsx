"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocalTime } from "@/components/ui/local-time";

type Role = "OWNER" | "ADMIN" | "MEMBER";
const ROLE_LABEL: Record<Role, string> = { OWNER: "Owner", ADMIN: "Admin", MEMBER: "Member" };

interface PendingInvite {
  id: string;
  email: string | null;
  role: Role;
  expiresAt: string;
}

/** RM Staff: invite people to an organization (including its first Owner). */
export function AdminInvitePanel({ orgId, pending, hasOwner }: { orgId: string; pending: PendingInvite[]; hasOwner: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(hasOwner ? "MEMBER" : "OWNER");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; inviteUrl: string; emailSent: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    setResult(null);
    const res = await fetch(`/api/admin/organizations/${orgId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const data = await res.json().catch(() => null);
    setSending(false);
    if (!res.ok) {
      setError(data?.error ?? "Couldn't send the invite.");
      return;
    }
    setResult({ email, inviteUrl: data.inviteUrl, emailSent: data.emailSent });
    setCopied(false);
    setEmail("");
    if (role === "OWNER") setRole("MEMBER");
    router.refresh();
  }

  async function revoke(id: string) {
    setBusyId(id);
    await fetch(`/api/admin/organizations/${orgId}/invites/${id}`, { method: "DELETE" });
    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {!hasOwner && (
        <p className="rounded-md bg-[var(--warning-subtle)] p-3 text-sm text-gray-800">
          This organization has no Owner yet. Invite one to set up their account and manage the organization.
        </p>
      )}
      <form onSubmit={invite} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor={`invite-email-${orgId}`}>Invite by email</Label>
          <Input
            id={`invite-email-${orgId}`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@organization.org"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`invite-role-${orgId}`}>Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger id={`invite-role-${orgId}`} className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="OWNER">Owner</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
              <SelectItem value="MEMBER">Member</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={sending || !email.trim()}>
          {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send invite
        </Button>
      </form>

      {error && <p className="text-sm text-[var(--danger)]" role="alert">{error}</p>}
      {result && (
        <div className="space-y-1.5 rounded-md border border-border p-3 text-sm">
          <p className="text-gray-700">
            {result.emailSent ? `Invite emailed to ${result.email}. The link, valid 7 days:` : `Email isn't set up. Send ${result.email} this link (valid 7 days):`}
          </p>
          <div className="flex gap-2">
            <Input readOnly value={result.inviteUrl} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              onClick={async () => {
                await navigator.clipboard.writeText(result.inviteUrl);
                setCopied(true);
              }}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy
            </Button>
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="rm-eyebrow">Pending invites</p>
          <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
            {pending.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-gray-900">{inv.email ?? "Open invite link"}</span>
                <Badge variant="secondary">{ROLE_LABEL[inv.role]}</Badge>
                <span className="text-xs text-gray-500">
                  expires <LocalTime iso={inv.expiresAt} />
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-gray-600"
                  disabled={busyId === inv.id}
                  onClick={() => revoke(inv.id)}
                  aria-label={`Revoke invite for ${inv.email ?? "invite link"}`}
                >
                  {busyId === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
