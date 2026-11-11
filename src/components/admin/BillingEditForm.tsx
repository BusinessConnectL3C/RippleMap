"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  BILLING_CYCLE_LABEL,
  BILLING_STATUS_LABEL,
  type BillingCycle,
  type BillingStatus,
} from "@/lib/billing";

export interface BillingFormValues {
  plan: string;
  status: BillingStatus;
  cycle: BillingCycle | "";
  /** Dollars, as typed. */
  amount: string;
  feltSeats: string;
  startDate: string;
  renewalDate: string;
  billingContactName: string;
  billingContactEmail: string;
  staffNotes: string;
}

interface Props {
  orgId: string;
  initial: BillingFormValues;
  isNew: boolean;
}

const orNull = (v: string) => (v.trim() ? v.trim() : null);

export function BillingEditForm({ orgId, initial, isNew }: Props) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof BillingFormValues>(key: K, value: BillingFormValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  async function save() {
    setError(null);

    let amountCents: number | null = null;
    if (v.amount.trim()) {
      const n = Number(v.amount.replace(/[$,\s]/g, ""));
      if (!Number.isFinite(n) || n < 0) {
        setError("Amount must be a positive number, e.g. 1200 or 99.50.");
        return;
      }
      amountCents = Math.round(n * 100);
    }
    const feltSeats = Number(v.feltSeats);
    if (!Number.isInteger(feltSeats) || feltSeats < 0) {
      setError("Felt seats must be a whole number.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/billing`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: orNull(v.plan),
          status: v.status,
          cycle: v.cycle || null,
          amountCents,
          feltSeats,
          startDate: v.startDate || null,
          renewalDate: v.renewalDate || null,
          billingContactName: orNull(v.billingContactName),
          billingContactEmail: orNull(v.billingContactEmail),
          staffNotes: orNull(v.staffNotes),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Save failed");
        return;
      }
      toast({ variant: "success", title: "Billing saved" });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {isNew && <p className="text-sm text-gray-600">No billing record yet. Fill in the terms and save to create one.</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="billing-plan">Plan</Label>
          <Input id="billing-plan" value={v.plan} onChange={(e) => set("plan", e.target.value)} placeholder="e.g. RippleMap Standard" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="billing-status">Status</Label>
          <Select value={v.status} onValueChange={(s) => set("status", s as BillingStatus)}>
            <SelectTrigger id="billing-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(BILLING_STATUS_LABEL) as BillingStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {BILLING_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="billing-amount">Price (USD)</Label>
          <Input
            id="billing-amount"
            inputMode="decimal"
            value={v.amount}
            onChange={(e) => set("amount", e.target.value)}
            placeholder="e.g. 1200"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="billing-cycle">Billed</Label>
          <Select value={v.cycle || "NONE"} onValueChange={(c) => set("cycle", c === "NONE" ? "" : (c as BillingCycle))}>
            <SelectTrigger id="billing-cycle">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE">Not set</SelectItem>
              {(Object.keys(BILLING_CYCLE_LABEL) as BillingCycle[]).map((c) => (
                <SelectItem key={c} value={c}>
                  {BILLING_CYCLE_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="billing-start">Start date</Label>
          <Input id="billing-start" type="date" value={v.startDate} onChange={(e) => set("startDate", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="billing-renewal">Renewal date</Label>
          <Input id="billing-renewal" type="date" value={v.renewalDate} onChange={(e) => set("renewalDate", e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="billing-seats">Felt seats included</Label>
          <Input
            id="billing-seats"
            inputMode="numeric"
            value={v.feltSeats}
            onChange={(e) => set("feltSeats", e.target.value)}
          />
        </div>
        <div />

        <div className="space-y-2">
          <Label htmlFor="billing-contact-name">Billing contact</Label>
          <Input
            id="billing-contact-name"
            value={v.billingContactName}
            onChange={(e) => set("billingContactName", e.target.value)}
            placeholder="Name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="billing-contact-email">Billing contact email</Label>
          <Input
            id="billing-contact-email"
            type="email"
            value={v.billingContactEmail}
            onChange={(e) => set("billingContactEmail", e.target.value)}
            placeholder="billing@example.org"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="billing-notes">Internal notes</Label>
        <Textarea
          id="billing-notes"
          rows={3}
          value={v.staffNotes}
          onChange={(e) => set("staffNotes", e.target.value)}
          placeholder="Visible to BC staff only"
        />
        <p className="text-xs text-gray-600">
          Not shown to the client. Don&apos;t record card numbers, bank account numbers or other payment details here.
        </p>
      </div>

      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Button onClick={save} disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        {isNew ? "Create billing record" : "Save billing"}
      </Button>
    </div>
  );
}
