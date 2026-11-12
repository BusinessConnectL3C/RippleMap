import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getViewUrl } from "@/lib/aws/s3";
import { getTemplate } from "@/lib/felt/templates";

/**
 * Thumbnail for a template in the "New map" gallery. Any signed-in user may
 * see template previews: templates are BC-owned sample maps, never client data.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse(null, { status: 401 });

  const { id } = await params;
  const template = await getTemplate(id);
  if (!template?.thumbnailKey) return new NextResponse(null, { status: 404 });

  return NextResponse.redirect(await getViewUrl(template.thumbnailKey), {
    status: 302,
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
