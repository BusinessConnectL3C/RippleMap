import Link from "next/link";
import { db } from "@/lib/db";
import { TopBar } from "@/components/layout/TopBar";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { feltSeatUsage } from "@/lib/felt/seats";

export default async function AdminOrgsPage() {
  const orgs = await db.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      onboardingState: { select: { completed: true } },
      _count: { select: { users: true } },
      users: { where: { feltSeat: true }, select: { feltInviteAcceptedAt: true } },
    },
  });
  const seats = await feltSeatUsage();

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Organizations"
        actions={
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/admin/organizations/new">
              <Plus className="h-3.5 w-3.5" /> New organization
            </Link>
          </Button>
        }
      />
      <div className="flex-1 p-6 space-y-4">
        <p className="text-sm text-gray-700">
          Felt seats:{" "}
          <span className={`font-semibold tabular-nums ${seats.used >= seats.limit ? "text-red-700" : "text-gray-900"}`}>
            {seats.used} of {seats.limit} used
          </span>{" "}
          <span className="text-gray-500">(as recorded in RippleMap, including RM Staff)</span>
        </p>
        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-700">Organization</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Onboarding</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">ArcGIS Group</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Users</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Felt seats</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orgs.map((org) => (
                <tr key={org.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/admin/organizations/${org.id}`} className="text-gray-900 hover:text-link hover:underline">
                      {org.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{org.type}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {org.onboardingState?.completed ? (
                      <span className="flex items-center gap-1 text-green-700">
                        <CheckCircle className="h-4 w-4" /> Complete
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-yellow-600">
                        <XCircle className="h-4 w-4" /> Incomplete
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {org.arcgisGroupId ? (
                      <span className="flex items-center gap-1 text-green-700">
                        <CheckCircle className="h-4 w-4" /> Set
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600">
                        <XCircle className="h-4 w-4" /> Missing
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{org._count.users}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {org.users.length === 0 ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <span className="tabular-nums">
                        {org.users.length}
                        {org.users.some((u) => !u.feltInviteAcceptedAt) && (
                          <Badge variant="warning" className="ml-2">
                            Invite pending
                          </Badge>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(org.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/organizations/${org.id}`}
                      className="flex items-center gap-1 text-link hover:text-link-hover hover:underline text-xs font-medium"
                    >
                      Manage <ChevronRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {orgs.length === 0 && (
            <div className="py-16 text-center text-gray-600 text-sm">No organizations yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
