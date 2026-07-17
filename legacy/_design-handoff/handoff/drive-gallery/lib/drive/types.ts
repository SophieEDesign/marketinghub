// lib/drive/types.ts
// Shared types for the native Google Drive gallery.

export type DriveGalleryFolder = {
  id: string
  name: string
  count: number
  /** Thumbnail URL for the collection cover, or null when the folder has no images. */
  coverThumb: string | null
}

export type DriveGalleryImage = {
  id: string
  name: string
  /** Uppercase file extension, e.g. "JPG" | "PNG". */
  type: string
  /** Grid/card thumbnail URL. */
  thumb: string
  /** Full-resolution URL for the lightbox. */
  full: string
  /** Direct download URL. */
  download: string
  /** Drive web view URL (fallback / "open in Drive"). */
  webViewLink: string | null
  width: number | null
  height: number | null
  modified: string | null
}

/** Folder listing response (root of subfolders). */
export type DriveFoldersResponse = {
  kind: "folders"
  folders: DriveGalleryFolder[]
}

/** Image listing response (inside one folder). */
export type DriveImagesResponse = {
  kind: "images"
  folder: { id: string; name: string; webViewLink: string | null }
  images: DriveGalleryImage[]
}

export type DriveGalleryResponse = DriveFoldersResponse | DriveImagesResponse

export type DriveGalleryError = { error: string }
