import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2),
  organization: z.string().min(2),
  email: z.string().email(),
  message: z.string().min(10),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
  }

  const { name, organization, email, message } = parsed.data;

  // TODO: wire up transactional email (Resend) or store to DB once email service is configured
  console.log("[inquiry]", { name, organization, email, message });

  return NextResponse.json({ ok: true }, { status: 200 });
}
