import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getInvoicesForContact } from "@/lib/salesforce/invoices";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sfLink = await db.salesforceLink.findUnique({
    where: { userId: session.user.id },
  });

  if (!sfLink) {
    return NextResponse.json({ invoices: [], message: "No Salesforce account linked" });
  }

  const invoices = await getInvoicesForContact(sfLink.contactId);
  return NextResponse.json({ invoices });
}
