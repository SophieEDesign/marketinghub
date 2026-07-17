import { NextResponse } from "next/server";
import {
  fileExtension,
  getDriveClient,
  isDriveConfigured,
  upsizeThumb,
} from "@/lib/drive/client";
import { hasMediaDownloadAccess } from "@/lib/auth/media-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FOLDER_MIME = "application/vnd.google-apps.folder";

export async function GET(request: Request) {
  const canDownload = await hasMediaDownloadAccess();

  if (!isDriveConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        canDownload,
        error:
          "Google Drive is not configured. Set DRIVE_GALLERY_ROOT_FOLDER_ID and service account credentials.",
      },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const folderId =
    searchParams.get("folderId") || process.env.DRIVE_GALLERY_ROOT_FOLDER_ID!;

  try {
    const drive = getDriveClient();
    const meta = await drive.files.get({
      fileId: folderId,
      fields: "id,name,webViewLink",
      supportsAllDrives: true,
    });

    const foldersRes = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
      fields: "files(id,name)",
      orderBy: "name",
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const subfolders = foldersRes.data.files ?? [];

    if (subfolders.length > 0) {
      const folders = await Promise.all(
        subfolders.map(async (sf) => {
          const imgs = await drive.files.list({
            q: `'${sf.id}' in parents and mimeType contains 'image/' and trashed = false`,
            fields: "files(id,thumbnailLink)",
            pageSize: 1,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
          });
          const first = imgs.data.files?.[0];
          return {
            id: sf.id as string,
            name: sf.name ?? "Untitled",
            count: imgs.data.files?.length ?? 0,
            coverThumb:
              upsizeThumb(first?.thumbnailLink, 800) ??
              (first?.id
                ? `https://drive.google.com/thumbnail?id=${first.id}&sz=w800`
                : null),
          };
        })
      );

      return NextResponse.json({
        configured: true,
        canDownload,
        kind: "folders",
        folder: {
          id: meta.data.id,
          name: meta.data.name ?? "Gallery",
          webViewLink: canDownload ? meta.data.webViewLink ?? null : null,
        },
        folders,
      });
    }

    const imagesRes = await drive.files.list({
      q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
      fields:
        "files(id,name,mimeType,thumbnailLink,webViewLink,webContentLink,modifiedTime)",
      orderBy: "name",
      pageSize: 200,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const images = (imagesRes.data.files ?? []).map((f) => {
      const id = f.id as string;
      return {
        id,
        name: (f.name ?? "Untitled").replace(/\.[^.]+$/, ""),
        type: fileExtension(f.name ?? "", f.mimeType),
        thumb:
          upsizeThumb(f.thumbnailLink, 800) ??
          `https://drive.google.com/thumbnail?id=${id}&sz=w800`,
        full: canDownload ? `https://drive.google.com/uc?id=${id}` : null,
        download: canDownload ? `/api/drive/download?fileId=${id}` : null,
        webViewLink: canDownload ? f.webViewLink ?? null : null,
      };
    });

    return NextResponse.json({
      configured: true,
      canDownload,
      kind: "images",
      folder: {
        id: meta.data.id,
        name: meta.data.name ?? "Gallery",
        webViewLink: canDownload ? meta.data.webViewLink ?? null : null,
      },
      images,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Drive error";
    return NextResponse.json(
      { configured: true, canDownload, error: message },
      { status: 500 }
    );
  }
}
