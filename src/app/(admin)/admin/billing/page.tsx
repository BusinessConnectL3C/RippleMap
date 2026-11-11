import Link from "next/link";
import { db } from "@/lib/db";
import { TopBar } from "@/components/layout/TopBar";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import {
  BILLING_STATUS_BADGE,
  BILLING_STATUS_LABEL,
  formatAmount,
  formatBillingDate,
} from "@/lib/billing";

export default async function AdminBillingPage() {
  const orgs = await db.organization.findMany({
    // BC's own orgs (any org holding a BC staff account) aren't billed.
    where: { users: { none: { role: "BC_STAFF" } } },
    include: { billing: true, _count: { select: { users: { where: { feltSeat: true } } } } },
    orderBy: { name: "asc" },
  });

  // Soonest renewals first; orgs with no billing record go last.
  const rows = [...orgs].sort((a, b) => {
    const ra = a.billing?.renewalDate?.getTime() ?? Infinity;
    const rb = b.billing?.renewalDate?.getTime() ?? Infinity;
    return ra - rb || a.name.localeCompare(b.name);
  });

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Billing" />
      <div className="flex-1 p-6 space-y-3">
        <p className="text-sm text-gray-600">
          Billing terms recorded for each organization. Edit them from the organization&apos;s page. Payment details
          (cards, bank accounts) are never stored in RippleMap.
        </p>
        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-700">Organization</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Plan</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Price</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Renews</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Felt seats</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((org) => {
                const b = org.billing;
                const seatsUsed = org._count.users;
                return (
                  <tr key={org.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{org.name}</td>
                    <td className="px-4 py-3 text-gray-700">{b?.plan ?? "—"}</td>
                    <td className="px-4 py-3">
                      {b ? (
                        <Badge variant={BILLING_STATUS_BADGE[b.status]}>{BILLING_STATUS_LABEL[b.status]}</Badge>
                      ) : (
                        <span className="text-xs text-gray-500">No record</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{formatAmount(b?.amountCents, b?.cycle)}</td>
                    <td className="px-4 py-3 text-gray-700">{formatBillingDate(b?.renewalDate)}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {b ? (
                        <span className={seatsUsed > b.feltSeats ? "font-medium text-red-700" : undefined}>
                          {seatsUsed} / {b.feltSeats}
                        </span>
                      ) : (
                        seatsUsed
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/organizations/${org.id}#billing`}
                        className="flex items-center gap-1 text-link hover:text-link-hover hover:underline text-xs font-medium"
                      >
                        Edit <ChevronRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <div className="py-16 text-center text-gray-600 text-sm">No organizations yet.</div>}
        </div>
      </div>
    </div>
  );
}
