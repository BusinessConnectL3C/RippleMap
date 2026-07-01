"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

  async function updateRole(userId: string, role: string) {
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
        <tr className="border-b border-gray-100 bg-gray-50">
          <th className="px-4 py-3 text-left font-medium text-gray-700">Name</th>
          <th className="px-4 py-3 text-left font-medium text-gray-700">Email</th>
          <th className="px-4 py-3 text-left font-medium text-gray-700">Role</th>
          <th className="px-4 py-3" />
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {members.map((member) => {
          const isSelf = member.id === currentUserId;
          const isOwnerLockedForAdmin = member.role === "OWNER" && currentUserRole !== "OWNER";
          const canEditRow = canManage && !isSelf && !isOwnerLockedForAdmin;

          return (
            <tr key={member.id}>
              <td className="px-4 py-3 font-medium text-gray-900">
                {member.name}
                {isSelf && <span className="ml-1 text-xs text-gray-400">(you)</span>}
              </td>
              <td className="px-4 py-3 text-gray-600">{member.email}</td>
              <td className="px-4 py-3">
                {canEditRow ? (
                  <>
                    <select
                      value={member.role}
                      disabled={pending === member.id + ":role"}
                      onChange={(e) => updateRole(member.id, e.target.value)}
                      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#1B4F72]"
                    >
                      {assignableRoles.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                    {pending === member.id + ":role" && (
                      <Loader2 className="inline ml-2 h-3 w-3 animate-spin text-gray-400" />
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
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
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
