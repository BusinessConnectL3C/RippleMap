import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard } from "lucide-react";

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Billing & Invoices" />
      <div className="flex-1 p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CreditCard className="h-14 w-14 text-text-muted mb-3" />
            <p className="font-display text-lg font-semibold text-text-primary">Billing coming soon</p>
            <p className="text-sm text-text-secondary mt-1">
              Contact your BC account manager for billing inquiries.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
