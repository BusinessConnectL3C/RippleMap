"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
};

export function UserRoleEditor({ users }: { users: User[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function updateRole(userId: string, name: string, role: string) {
    if (
      (role === "OWNER" || role === "ADMIN") &&
      !confirm(`Give ${name} ${ROLE_LABEL[role]} access to this organization?`)
    ) {
      return;
    }
    setPending(userId + ":role");
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setPending(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast({ variant: "danger", title: "Could not update role", description: data?.error ?? "Please try again." });
      return;
    }
    router.refresh();
  }

  async function removeUser(userId: string, name: string) {
    if (!confirm(`Remove ${name} from this organization?`)) return;
    setPending(userId + ":remove");
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    setPending(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast({ variant: "danger", title: "Could not remove user", description: data?.error ?? "Please try again." });
      return;
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
        {users.map((user) => (
          <tr key={user.id}>
            <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
            <td className="px-4 py-3 text-gray-600">{user.email}</td>
            <td className="px-4 py-3">
              <Select
                value={user.role}
                disabled={pending === user.id + ":role"}
                onValueChange={(value) => updateRole(user.id, user.name, value)}
              >
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OWNER">Owner</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MEMBER">Member</SelectItem>
                </SelectContent>
              </Select>
              {pending === user.id + ":role" && (
                <Loader2 className="inline ml-2 h-3 w-3 animate-spin text-gray-600" />
              )}
            </td>
            <td className="px-4 py-3 text-right">
              <Button
                variant="ghost"
                size="sm"
                disabled={pending === user.id + ":remove"}
                onClick={() => removeUser(user.id, user.name)}
                aria-label={`Remove ${user.name}`}
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                {pending === user.id + ":remove" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
