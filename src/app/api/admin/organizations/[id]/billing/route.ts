import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffViewer } from "@/lib/staff";

const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .nullable()
  .transform((v) => (v ? new Date(`${v}T00:00:00.000Z`) : null));

const billingSchema = z.object({
  plan: z.string().trim().max(200).nullable(),
  status: z.enum(["FREE", "TRIAL", "ACTIVE", "PAST_DUE", "CANCELED"]),
  cycle: z.enum(["MONTHLY", "ANNUAL"]).nullable(),
  amountCents: z.number().int().min(0).max(100_000_000).nullable(),
  feltSeats: z.number().int().min(0).max(100),
  startDate: dateField,
  renewalDate: dateField,
  billingContactName: z.string().trim().max(200).nullable(),
  billingContactEmail: z.string().trim().email().max(320).nullable(),
  staffNotes: z.string().max(5000).nullable(),
});

/**
 * BC staff: create or replace an org's billing record. These are the terms
 * BC has agreed with the client — this route stores no payment details
 * (cards, bank accounts), and must never be extended to.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffViewer();
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = billingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input" },
      { status: 400 }
    );
  }

  const { id: orgId } = await params;
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { id: true } });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = { ...parsed.data, updatedById: staff.id };
  await db.orgBilling.upsert({
    where: { orgId },
    create: { orgId, ...data },
    update: data,
  });

  return NextResponse.json({ ok: true });
}
