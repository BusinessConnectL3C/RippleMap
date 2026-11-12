import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getViewer } from "@/lib/felt/access";
import { completeFileUpload, serializeUpload, UploadError } from "@/lib/felt/uploads";

/** The browser finished uploading the file to S3: verify it and start Felt's import. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ feltMapId: string; uploadId: string }> }
) {
  const session = await auth();
  const viewer = session?.user?.id ? await getViewer(session.user.id) : null;
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { feltMapId, uploadId } = await params;
  try {
    const upload = await completeFileUpload(viewer, feltMapId, uploadId, req.nextUrl.origin);
    return NextResponse.json({ upload: serializeUpload(upload) });
  } catch (err) {
    if (err instanceof UploadError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
