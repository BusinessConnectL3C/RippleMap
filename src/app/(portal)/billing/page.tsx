import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { CreditCard } from "lucide-react";

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Billing & Invoices" />
      <div className="flex-1 p-6">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CreditCard className="h-14 w-14 text-gray-300 mb-3" />
          <p className="text-lg font-medium text-gray-700">Billing coming soon</p>
          <p className="text-sm text-gray-500 mt-1">
            Contact your BC account manager for billing inquiries.
          </p>
        </div>
      </div>
    </div>
  );
}
