"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function UserRoleEditor({ users }: { users: User[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function updateRole(userId: string, role: string) {
    setPending(userId + ":role");
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setPending(null);
    router.refresh();
  }

  async function removeUser(userId: string, name: string) {
    if (!confirm(`Remove ${name} from this organization?`)) return;
    setPending(userId + ":remove");
    await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    setPending(null);
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
              <select
                value={user.role}
                disabled={pending === user.id + ":role"}
                onChange={(e) => updateRole(user.id, e.target.value)}
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#1B4F72]"
              >
                <option value="OWNER">Owner</option>
                <option value="ADMIN">Admin</option>
                <option value="MEMBER">Member</option>
              </select>
              {pending === user.id + ":role" && (
                <Loader2 className="inline ml-2 h-3 w-3 animate-spin text-gray-400" />
              )}
            </td>
            <td className="px-4 py-3 text-right">
              <Button
                variant="ghost"
                size="sm"
                disabled={pending === user.id + ":remove"}
                onClick={() => removeUser(user.id, user.name)}
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
