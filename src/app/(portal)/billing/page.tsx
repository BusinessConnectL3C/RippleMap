import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, ExternalLink } from "lucide-react";

async function fetchInvoices(contactId: string) {
  try {
    const { getInvoicesForContact } = await import("@/lib/salesforce/invoices");
    return await getInvoicesForContact(contactId);
  } catch {
    return [];
  }
}

const STATUS_VARIANTS = {
  Paid: "success",
  Sent: "default",
  Draft: "secondary",
  Overdue: "destructive",
  Cancelled: "secondary",
} as const;

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const sfLink = await db.salesforceLink.findUnique({
    where: { userId: session.user.id },
  });

  const invoices = sfLink ? await fetchInvoices(sfLink.contactId) : [];

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Billing & Invoices" />
      <div className="flex-1 p-6 space-y-4">
        {!sfLink && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
            Your account hasn&apos;t been linked to a billing record yet. Contact your BC account manager.
          </div>
        )}

        {invoices.length === 0 && sfLink && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CreditCard className="h-14 w-14 text-gray-300 mb-3" />
            <p className="text-lg font-medium text-gray-700">No invoices found</p>
          </div>
        )}

        {invoices.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Invoice</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Amount</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Due Date</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invoices.map((inv) => (
                      <tr key={inv.Id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{inv.Name}</td>
                        <td className="px-4 py-3 text-gray-700">
                          ${inv.Amount__c?.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{inv.Due_Date__c}</td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_VARIANTS[inv.Status__c] ?? "secondary"}>
                            {inv.Status__c}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {inv.Invoice_PDF__c && (
                            <a
                              href={inv.Invoice_PDF__c}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[#1B4F72] hover:underline text-xs"
                            >
                              PDF <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
