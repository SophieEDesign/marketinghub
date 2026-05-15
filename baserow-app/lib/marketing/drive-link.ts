/**
 * Google Drive / cloud link parsing — provider detection, thumbnails, embed URLs.
 */

export type DriveProvider =
  | "google_drive"
  | "google_docs"
  | "google_slides"
  | "google_sheets"
  | "onedrive"
  | "sharepoint"
  | "dropbox"
  | "external"

export type DriveFileKind =
  | "pdf"
  | "image"
  | "video"
  | "presentation"
  | "document"
  | "spreadsheet"
  | "folder"
  | "file"

export interface ParsedDriveLink {
  url: string
  provider: DriveProvider
  providerLabel: string
  fileId: string | null
  fileKind: DriveFileKind
  fileKindLabel: string
  thumbnailUrl: string | null
  embedUrl: string | null
  openUrl: string
}

const PROVIDER_LABELS: Record<DriveProvider, string> = {
  google_drive: "Google Drive",
  google_docs: "Google Docs",
  google_slides: "Google Slides",
  google_sheets: "Google Sheets",
  onedrive: "OneDrive",
  sharepoint: "SharePoint",
  dropbox: "Dropbox",
  external: "Link",
}

const KIND_LABELS: Record<DriveFileKind, string> = {
  pdf: "PDF",
  image: "Image",
  video: "Video",
  presentation: "Presentation",
  document: "Document",
  spreadsheet: "Spreadsheet",
  folder: "Folder",
  file: "File",
}

function extractDriveFileId(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    if (host.includes("drive.google.com")) {
      const m = u.pathname.match(/\/file\/d\/([^/]+)/) || u.pathname.match(/\/folders\/([^/]+)/)
      if (m?.[1]) return m[1]
      const idParam = u.searchParams.get("id")
      if (idParam) return idParam
    }
    if (host.includes("docs.google.com")) {
      const m =
        u.pathname.match(/\/document\/d\/([^/]+)/) ||
        u.pathname.match(/\/presentation\/d\/([^/]+)/) ||
        u.pathname.match(/\/spreadsheets\/d\/([^/]+)/)
      if (m?.[1]) return m[1]
    }
  } catch {
    /* invalid */
  }
  return null
}

function detectFileKind(url: string, provider: DriveProvider): DriveFileKind {
  const lower = url.toLowerCase()
  if (provider === "google_slides" || /\/presentation\//i.test(lower) || /\/slides\//i.test(lower))
    return "presentation"
  if (provider === "google_docs" || /\/document\//i.test(lower)) return "document"
  if (provider === "google_sheets" || /\/spreadsheets\//i.test(lower)) return "spreadsheet"
  if (/\/folders\//i.test(lower)) return "folder"
  if (/\.pdf(\?|$)/i.test(lower) || lower.includes("pdf")) return "pdf"
  if (/\.(jpe?g|png|gif|webp|svg)(\?|$)/i.test(lower)) return "image"
  if (/\.(mp4|webm|mov)(\?|$)/i.test(lower)) return "video"
  return "file"
}

function detectProvider(url: string): DriveProvider {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (host.includes("docs.google.com")) {
      if (url.includes("/presentation/")) return "google_slides"
      if (url.includes("/spreadsheets/")) return "google_sheets"
      return "google_docs"
    }
    if (host.includes("drive.google.com")) return "google_drive"
    if (host.includes("onedrive") || host.includes("1drv.ms")) return "onedrive"
    if (host.includes("sharepoint")) return "sharepoint"
    if (host.includes("dropbox")) return "dropbox"
  } catch {
    /* invalid */
  }
  return "external"
}

function buildThumbnailUrl(fileId: string | null, kind: DriveFileKind): string | null {
  if (!fileId) return null
  if (kind === "image" || kind === "file") {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`
  }
  return null
}

function buildEmbedUrl(url: string, fileId: string | null, provider: DriveProvider): string | null {
  if (!fileId) return null
  if (provider === "google_slides")
    return `https://docs.google.com/presentation/d/${fileId}/embed?start=false&loop=false`
  if (provider === "google_docs")
    return `https://docs.google.com/document/d/${fileId}/preview`
  if (provider === "google_sheets")
    return `https://docs.google.com/spreadsheets/d/${fileId}/preview`
  if (provider === "google_drive")
    return `https://drive.google.com/file/d/${fileId}/preview`
  return null
}

export function parseDriveLink(url: string | null | undefined): ParsedDriveLink | null {
  const raw = String(url || "").trim()
  if (!raw) return null
  try {
    new URL(raw)
  } catch {
    return null
  }

  const provider = detectProvider(raw)
  const fileId = extractDriveFileId(raw)
  const fileKind = detectFileKind(raw, provider)

  return {
    url: raw,
    provider,
    providerLabel: PROVIDER_LABELS[provider],
    fileId,
    fileKind,
    fileKindLabel: KIND_LABELS[fileKind],
    thumbnailUrl: buildThumbnailUrl(fileId, fileKind),
    embedUrl: buildEmbedUrl(raw, fileId, provider),
    openUrl: raw,
  }
}

export function formatDriveSourceLabel(link: ParsedDriveLink | null): string {
  if (!link) return "Link"
  return link.providerLabel
}
