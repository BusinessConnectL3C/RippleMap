/** Display helpers for OrgBilling. Pure and client-safe. */

export type BillingStatus = "FREE" | "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELED";
export type BillingCycle = "MONTHLY" | "ANNUAL";

export const BILLING_STATUS_LABEL: Record<BillingStatus, string> = {
  FREE: "Free",
  TRIAL: "Trial",
  ACTIVE: "Active",
  PAST_DUE: "Past due",
  CANCELED: "Canceled",
};

export const BILLING_STATUS_BADGE: Record<BillingStatus, "info" | "success" | "warning" | "secondary"> = {
  FREE: "secondary",
  TRIAL: "info",
  ACTIVE: "success",
  PAST_DUE: "warning",
  CANCELED: "secondary",
};

export const BILLING_CYCLE_LABEL: Record<BillingCycle, string> = {
  MONTHLY: "Monthly",
  ANNUAL: "Annual",
};

export function formatAmount(amountCents: number | null | undefined, cycle?: BillingCycle | null): string {
  if (amountCents == null) return "—";
  const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amountCents / 100);
  if (!cycle) return amount;
  return `${amount} / ${cycle === "MONTHLY" ? "month" : "year"}`;
}

/** Dates are stored as UTC midnight; format in UTC so they don't shift a day. */
export function formatBillingDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });
}

/** yyyy-mm-dd for <input type="date">. */
export function toDateInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}
