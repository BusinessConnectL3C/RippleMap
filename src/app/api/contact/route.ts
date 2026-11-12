import { NextRequest, NextResponse } from "next/server";
import { contactSchema, submitContact } from "@/lib/contact";

/** Public: the website contact form. */
export async function POST(req: NextRequest) {
  const parsed = contactSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Please check the form", field: first?.path[0] }, { status: 400 });
  }
  const result = await submitContact(parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
