import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard } from "lucide-react";
import {
  BILLING_CYCLE_LABEL,
  BILLING_STATUS_BADGE,
  BILLING_STATUS_LABEL,
  formatAmount,
  formatBillingDate,
} from "@/lib/billing";

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, orgId: true },
  });
  if (!user) redirect("/login");
  // BC staff view and edit every org's billing in the admin portal.
  if (user.role === "BC_STAFF") redirect("/admin/billing");

  // Pricing is Confidential: only the org's owners and admins see it.
  const canView = user.role === "OWNER" || user.role === "ADMIN";
  const billing = canView
    ? await db.orgBilling.findUnique({
        where: { orgId: user.orgId },
        // staffNotes is internal to BC and never selected here.
        select: {
          plan: true,
          status: true,
          cycle: true,
          amountCents: true,
          feltSeats: true,
          startDate: true,
          renewalDate: true,
          billingContactName: true,
          billingContactEmail: true,
        },
      })
    : null;

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Billing" />
      <div className="flex-1 p-6 max-w-3xl">
        {!canView ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <CreditCard className="h-14 w-14 text-text-muted mb-3" />
              <p className="font-display text-lg font-semibold text-text-primary">Billing is managed by your organization&apos;s owners and admins</p>
              <p className="text-sm text-text-secondary mt-1">Ask one of them if you have a billing question.</p>
            </CardContent>
          </Card>
        ) : !billing ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <CreditCard className="h-14 w-14 text-text-muted mb-3" />
              <p className="font-display text-lg font-semibold text-text-primary">Billing details aren&apos;t set up yet</p>
              <p className="text-sm text-text-secondary mt-1">Contact your BC account manager for billing inquiries.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>{billing.plan ?? "Your plan"}</CardTitle>
              <Badge variant={BILLING_STATUS_BADGE[billing.status]}>{BILLING_STATUS_LABEL[billing.status]}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="rm-eyebrow">Price</dt>
                  <dd className="font-medium text-text-primary">{formatAmount(billing.amountCents, billing.cycle)}</dd>
                </div>
                <div>
                  <dt className="rm-eyebrow">Billed</dt>
                  <dd className="font-medium text-text-primary">{billing.cycle ? BILLING_CYCLE_LABEL[billing.cycle] : "—"}</dd>
                </div>
                <div>
                  <dt className="rm-eyebrow">Started</dt>
                  <dd className="font-medium text-text-primary">{formatBillingDate(billing.startDate)}</dd>
                </div>
                <div>
                  <dt className="rm-eyebrow">Renews</dt>
                  <dd className="font-medium text-text-primary">{formatBillingDate(billing.renewalDate)}</dd>
                </div>
                <div>
                  <dt className="rm-eyebrow">Field Editor seats</dt>
                  <dd className="font-medium text-text-primary">{billing.feltSeats}</dd>
                </div>
                <div>
                  <dt className="rm-eyebrow">Billing contact</dt>
                  <dd className="font-medium text-text-primary">
                    {billing.billingContactName ?? "—"}
                    {billing.billingContactEmail && (
                      <span className="block text-xs font-normal text-text-secondary">{billing.billingContactEmail}</span>
                    )}
                  </dd>
                </div>
              </dl>
              <p className="text-xs text-text-muted">
                To change your plan, seats or billing contact, contact your BC account manager or open a support request.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
