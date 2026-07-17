import { NextRequest, NextResponse } from "next/server";
import { getDriveClient, isDriveConfigured } from "@/lib/drive/client";
import { hasMediaDownloadAccess } from "@/lib/auth/media-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const allowed = await hasMediaDownloadAccess();
  if (!allowed) {
    return NextResponse.json(
      {
        error: "Sign in required to download",
        loginUrl: "/login?intent=media&next=/media",
      },
      { status: 401 }
    );
  }

  if (!isDriveConfigured()) {
    return NextResponse.json(
      { error: "Google Drive is not configured" },
      { status: 503 }
    );
  }

  const fileId = request.nextUrl.searchParams.get("fileId");
  if (!fileId) {
    return NextResponse.json({ error: "fileId required" }, { status: 400 });
  }

  try {
    const drive = getDriveClient();
    const meta = await drive.files.get({
      fileId,
      fields: "id,name,mimeType",
      supportsAllDrives: true,
    });

    const file = await drive.files.get(
      {
        fileId,
        alt: "media",
        supportsAllDrives: true,
      },
      { responseType: "arraybuffer" }
    );

    const buffer = Buffer.from(file.data as ArrayBuffer);
    const name = meta.data.name ?? "download";
    const mime = meta.data.mimeType ?? "application/octet-stream";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename="${name.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Download failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
