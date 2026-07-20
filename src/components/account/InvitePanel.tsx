"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Copy, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PendingInvite {
  id: string;
  email: string | null;
  role: "ADMIN" | "MEMBER";
  expiresAt: string;
}

export function InvitePanel({ pendingInvites }: { pendingInvites: PendingInvite[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  async function handleInvite() {
    setSending(true);
    setError(null);
    setNewLink(null);
    const trimmedEmail = email.trim();
    const res = await fetch("/api/account/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmedEmail, role }),
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok) {
      setError(data.error ?? "Could not send invite");
      return;
    }
    setEmailSent(!!data.emailSent);
    setSentTo(trimmedEmail);
    setNewLink(data.emailSent ? null : data.inviteUrl);
    setEmail("");
    router.refresh();
  }

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function revokeInvite(id: string) {
    setPendingAction(id);
    await fetch(`/api/account/invites/${id}`, { method: "DELETE" });
    setPendingAction(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="inviteEmail">Email address</Label>
          <Input
            id="inviteEmail"
            type="email"
            placeholder="teammate@org.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="inviteRole">Role</Label>
          <Select value={role} onValueChange={(value) => setRole(value as "ADMIN" | "MEMBER")}>
            <SelectTrigger id="inviteRole" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MEMBER">Member</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleInvite} disabled={sending || !email.trim()}>
          {sending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Invite
        </Button>
      </div>

      {error && <div className="rounded-md bg-[var(--danger-subtle)] p-3 text-sm text-[var(--danger)]">{error}</div>}

      {emailSent && sentTo && (
        <div className="rounded-md bg-[var(--success-subtle)] border border-[var(--success)]/30 p-3 text-sm text-[var(--success)]">
          Invite sent to {sentTo}.
        </div>
      )}

      {newLink && (
        <div className="rounded-md bg-[var(--info-subtle)] border border-[var(--info)]/30 p-3 text-sm space-y-2">
          <p className="text-[var(--info)]">
            No email service is connected yet — copy this link and send it to your teammate directly.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-surface-card border border-[var(--info)]/30 px-2 py-1 text-xs text-text-secondary font-mono">
              {newLink}
            </code>
            <Button variant="outline" size="sm" onClick={() => copyLink(newLink)} className="gap-1">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}

      {pendingInvites.length > 0 && (
        <div className="border-t border-border pt-4">
          <p className="rm-eyebrow mb-2">Pending invites</p>
          <ul className="space-y-2">
            {pendingInvites.map((invite) => (
              <li key={invite.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-text-primary">{invite.email ?? "Open invite link"}</span>
                  <Badge variant="secondary" className="text-xs">
                    {invite.role === "ADMIN" ? "Admin" : "Member"}
                  </Badge>
                  <span className="text-xs text-text-muted">
                    Expires {new Date(invite.expiresAt).toLocaleDateString()}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendingAction === invite.id}
                  onClick={() => revokeInvite(invite.id)}
                  className="text-[var(--danger)] hover:bg-[var(--danger-subtle)] hover:text-[var(--danger)]"
                >
                  {pendingAction === invite.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
