"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Member {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "BC_STAFF";
}

interface Props {
  members: Member[];
  currentUserId: string;
  currentUserRole: "OWNER" | "ADMIN" | "MEMBER" | "BC_STAFF";
}

const ROLE_LABEL: Record<Member["role"], string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  BC_STAFF: "BC Staff",
};

export function MembersTable({ members, currentUserId, currentUserRole }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const canManage = currentUserRole === "OWNER" || currentUserRole === "ADMIN";
  const assignableRoles: Member["role"][] =
    currentUserRole === "OWNER" ? ["OWNER", "ADMIN", "MEMBER"] : ["ADMIN", "MEMBER"];

  async function updateRole(userId: string, name: string, role: string) {
    if (
      (role === "OWNER" || role === "ADMIN") &&
      !confirm(`Give ${name} ${ROLE_LABEL[role as Member["role"]]} access to this organization?`)
    ) {
      return;
    }
    setPending(userId + ":role");
    const res = await fetch(`/api/account/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setPending(null);
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Could not update role");
    }
    router.refresh();
  }

  async function removeMember(userId: string, name: string) {
    if (!confirm(`Remove ${name} from this organization?`)) return;
    setPending(userId + ":remove");
    const res = await fetch(`/api/account/members/${userId}`, { method: "DELETE" });
    setPending(null);
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Could not remove member");
    }
    router.refresh();
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border bg-surface-sunken">
          <th className="px-4 py-3 text-left rm-eyebrow">Name</th>
          <th className="px-4 py-3 text-left rm-eyebrow">Email</th>
          <th className="px-4 py-3 text-left rm-eyebrow">Role</th>
          <th className="px-4 py-3" />
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {members.map((member) => {
          const isSelf = member.id === currentUserId;
          const isOwnerLockedForAdmin = member.role === "OWNER" && currentUserRole !== "OWNER";
          const canEditRow = canManage && !isSelf && !isOwnerLockedForAdmin;

          return (
            <tr key={member.id} className="hover:bg-surface-hover">
              <td className="px-4 py-3 font-medium text-text-primary">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--green-600)] text-xs font-semibold text-white">
                    {member.name?.[0]?.toUpperCase() ?? "?"}
                  </span>
                  <span>
                    {member.name}
                    {isSelf && <span className="ml-1 text-xs text-text-muted">(you)</span>}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-text-secondary">{member.email}</td>
              <td className="px-4 py-3">
                {canEditRow ? (
                  <>
                    <Select
                      value={member.role}
                      disabled={pending === member.id + ":role"}
                      onValueChange={(value) => updateRole(member.id, member.name, value)}
                    >
                      <SelectTrigger className="h-8 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {assignableRoles.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {pending === member.id + ":role" && (
                      <Loader2 className="inline ml-2 h-3 w-3 animate-spin text-text-muted" />
                    )}
                  </>
                ) : (
                  <Badge variant="secondary">{ROLE_LABEL[member.role]}</Badge>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {canEditRow && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending === member.id + ":remove"}
                    onClick={() => removeMember(member.id, member.name)}
                    aria-label={`Remove ${member.name}`}
                    className="text-[var(--danger)] hover:bg-[var(--danger-subtle)] hover:text-[var(--danger)]"
                  >
                    {pending === member.id + ":remove" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
