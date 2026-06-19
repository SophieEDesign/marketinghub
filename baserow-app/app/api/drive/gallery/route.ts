// Lists the shared Drive gallery natively. Folder view (subfolders) or image view (one folder).
//
//   GET /api/drive/gallery                  -> folders in DRIVE_GALLERY_ROOT_FOLDER_ID
//   GET /api/drive/gallery?folderId=<id>    -> folders in <id>, OR images if it has no subfolders
//
// Server-only. Cached for 5 minutes (Drive list calls are slow + rate-limited).

import { NextResponse } from "next/server"
import { getDriveClient, upsizeThumb, fileExtension } from "@/lib/drive/client"
import type {
  DriveGalleryFolder,
  DriveGalleryImage,
  DriveGalleryResponse,
} from "@/lib/drive/types"

export const revalidate = 300
export const dynamic = "force-dynamic"

const FOLDER_MIME = "application/vnd.google-apps.folder"

async function listSubfolders(driveId: string) {
  const drive = getDriveClient()
  const res = await drive.files.list({
    q: `'${driveId}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: "files(id,name)",
    orderBy: "name",
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  return res.data.files ?? []
}

async function listImages(driveId: string) {
  const drive = getDriveClient()
  const res = await drive.files.list({
    q: `'${driveId}' in parents and mimeType contains 'image/' and trashed = false`,
    fields:
      "files(id,name,mimeType,thumbnailLink,webViewLink,webContentLink,modifiedTime,imageMediaMetadata(width,height))",
    orderBy: "name",
    pageSize: 200,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  return res.data.files ?? []
}

function toImage(f: {
  id?: string | null
  name?: string | null
  mimeType?: string | null
  thumbnailLink?: string | null
  webViewLink?: string | null
  webContentLink?: string | null
  modifiedTime?: string | null
  imageMediaMetadata?: { width?: number | null; height?: number | null } | null
}): DriveGalleryImage {
  const id = f.id as string
  return {
    id,
    name: (f.name ?? "Untitled").replace(/\.[^.]+$/, ""),
    type: fileExtension(f.name ?? "", f.mimeType),
    thumb: upsizeThumb(f.thumbnailLink, 800) ?? `https://drive.google.com/thumbnail?id=${id}&sz=w800`,
    full: `https://drive.google.com/uc?id=${id}`,
    download: f.webContentLink ?? `https://drive.google.com/uc?export=download&id=${id}`,
    webViewLink: f.webViewLink ?? null,
    width: f.imageMediaMetadata?.width ?? null,
    height: f.imageMediaMetadata?.height ?? null,
    modified: f.modifiedTime ?? null,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const folderId = searchParams.get("folderId") || process.env.DRIVE_GALLERY_ROOT_FOLDER_ID

  if (!folderId) {
    return NextResponse.json(
      { error: "No folder id. Set DRIVE_GALLERY_ROOT_FOLDER_ID or pass ?folderId=" },
      { status: 400 }
    )
  }

  try {
    const subfolders = await listSubfolders(folderId)

    if (subfolders.length > 0) {
      const folders: DriveGalleryFolder[] = await Promise.all(
        subfolders.map(async (sf) => {
          const imgs = await listImages(sf.id as string)
          return {
            id: sf.id as string,
            name: sf.name ?? "Untitled",
            count: imgs.length,
            coverThumb:
              upsizeThumb(imgs[0]?.thumbnailLink, 800) ??
              (imgs[0]?.id ? `https://drive.google.com/thumbnail?id=${imgs[0].id}&sz=w800` : null),
          }
        })
      )
      const body: DriveGalleryResponse = { kind: "folders", folders }
      return NextResponse.json(body, {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
      })
    }

    const drive = getDriveClient()
    const meta = await drive.files.get({
      fileId: folderId,
      fields: "id,name,webViewLink",
      supportsAllDrives: true,
    })
    const images = (await listImages(folderId)).map(toImage)
    const body: DriveGalleryResponse = {
      kind: "images",
      folder: {
        id: meta.data.id as string,
        name: meta.data.name ?? "Gallery",
        webViewLink: meta.data.webViewLink ?? null,
      },
      images,
    }
    return NextResponse.json(body, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load gallery"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
