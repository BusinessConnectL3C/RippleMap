"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Copy, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

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
  const [copied, setCopied] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  async function handleInvite() {
    setSending(true);
    setError(null);
    setNewLink(null);
    const res = await fetch("/api/account/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), role }),
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok) {
      setError(data.error ?? "Could not send invite");
      return;
    }
    setNewLink(data.inviteUrl);
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
          <Label htmlFor="inviteEmail">Email address (optional)</Label>
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
          <select
            id="inviteRole"
            value={role}
            onChange={(e) => setRole(e.target.value as "ADMIN" | "MEMBER")}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]"
          >
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <Button onClick={handleInvite} disabled={sending} className="bg-[#1B4F72] hover:bg-[#154060]">
          {sending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Invite
        </Button>
      </div>
      <p className="text-xs text-gray-400">
        Leave email blank to generate an open link anyone can use to join as {role === "ADMIN" ? "an Admin" : "a Member"}.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {newLink && (
        <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm space-y-2">
          <p className="text-blue-800">
            No email service is connected yet — copy this link and send it to your teammate directly.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-white border border-blue-200 px-2 py-1 text-xs text-gray-700">
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
        <div className="border-t border-gray-100 pt-4">
          <p className="mb-2 text-sm font-medium text-gray-700">Pending invites</p>
          <ul className="space-y-2">
            {pendingInvites.map((invite) => (
              <li key={invite.id} className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-900">{invite.email ?? "Open invite link"}</span>
                  <Badge variant="secondary" className="text-xs">
                    {invite.role === "ADMIN" ? "Admin" : "Member"}
                  </Badge>
                  <span className="text-xs text-gray-400">
                    Expires {new Date(invite.expiresAt).toLocaleDateString()}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendingAction === invite.id}
                  onClick={() => revokeInvite(invite.id)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
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
