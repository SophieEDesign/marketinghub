// Server-only Google Drive client (service-account auth). Never import from a client component.

import { google, type drive_v3 } from "googleapis"

let cached: drive_v3.Drive | null = null

/**
 * Returns a memoised, read-only Drive client authed with the service account.
 * Requires env: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.
 */
export function getDriveClient(): drive_v3.Drive {
  if (cached) return cached

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY

  if (!email || !rawKey) {
    throw new Error(
      "Drive gallery not configured: set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY."
    )
  }

  // Env stores newlines as the literal characters \n — convert back to real newlines.
  const privateKey = rawKey.replace(/\\n/g, "\n")

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  })

  cached = google.drive({ version: "v3", auth })
  return cached
}

/** Bump a Drive thumbnailLink to a larger size (default =s220 → =s800). */
export function upsizeThumb(thumbnailLink: string | null | undefined, size = 800): string | null {
  if (!thumbnailLink) return null
  return thumbnailLink.replace(/=s\d+$/, `=s${size}`)
}

export function fileExtension(name: string, mimeType?: string | null): string {
  const dot = name.lastIndexOf(".")
  if (dot > -1 && dot < name.length - 1) return name.slice(dot + 1).toUpperCase()
  if (mimeType?.includes("png")) return "PNG"
  if (mimeType?.includes("jpeg") || mimeType?.includes("jpg")) return "JPG"
  return "IMG"
}
