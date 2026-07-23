import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api";
import { getDataDir } from "@/lib/store/paths";
import {
  isForcedDownloadExt,
  MIME_BY_EXT,
} from "@/lib/upload/allowed-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UPLOAD_ROOT = path.join(getDataDir(), "uploads", "content");

export async function GET(
  _request: NextRequest,
  context: { params: { filename: string } }
) {
  const { error } = await requireStaff();
  if (error) return error;

  const raw = decodeURIComponent(context.params.filename || "");
  const filename = path.basename(raw);
  if (!filename || filename !== raw.replace(/^.*[/\\]/, "")) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }

  const filePath = path.join(UPLOAD_ROOT, filename);
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    if (ext === ".svg") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const isDownload = isForcedDownloadExt(ext);
    return new NextResponse(data, {
      headers: {
        "Content-Type": MIME_BY_EXT[ext] || "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
        ...(isDownload
          ? {
              "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
            }
          : {}),
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
