import { google, type drive_v3 } from "googleapis";

type Creds =
  | { email: string; privateKey: string }
  | { error: string };

export function readServiceAccountCredentials(): Creds {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (json) {
    try {
      const parsed = JSON.parse(json) as {
        client_email?: string;
        private_key?: string;
      };
      if (!parsed.client_email || !parsed.private_key) {
        return { error: "GOOGLE_SERVICE_ACCOUNT_JSON missing client_email/private_key" };
      }
      return { email: parsed.client_email, privateKey: parsed.private_key };
    } catch {
      return { error: "Invalid GOOGLE_SERVICE_ACCOUNT_JSON" };
    }
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n"
  );
  if (!email || !privateKey) {
    return {
      error:
        "Set GOOGLE_SERVICE_ACCOUNT_JSON or EMAIL + PRIVATE_KEY, plus DRIVE_GALLERY_ROOT_FOLDER_ID",
    };
  }
  return { email, privateKey };
}

let cached: drive_v3.Drive | null = null;

export function getDriveClient(): drive_v3.Drive {
  if (cached) return cached;
  const creds = readServiceAccountCredentials();
  if ("error" in creds) throw new Error(creds.error);

  const auth = new google.auth.JWT({
    email: creds.email,
    key: creds.privateKey,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  cached = google.drive({ version: "v3", auth });
  return cached;
}

export function upsizeThumb(
  thumbnailLink: string | null | undefined,
  size = 800
): string | null {
  if (!thumbnailLink) return null;
  return thumbnailLink.replace(/=s\d+$/, `=s${size}`);
}

export function fileExtension(name: string, mimeType?: string | null): string {
  const dot = name.lastIndexOf(".");
  if (dot > -1 && dot < name.length - 1) return name.slice(dot + 1).toUpperCase();
  if (mimeType?.includes("png")) return "PNG";
  if (mimeType?.includes("jpeg") || mimeType?.includes("jpg")) return "JPG";
  return "IMG";
}

export function isDriveConfigured() {
  return Boolean(
    process.env.DRIVE_GALLERY_ROOT_FOLDER_ID &&
      (process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
        (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
          process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY))
  );
}

/** Drive file/folder IDs are alphanumeric with `_` / `-`. */
export function isSafeDriveId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{10,128}$/.test(id);
}

export function getDriveGalleryRootId(): string | null {
  const root = process.env.DRIVE_GALLERY_ROOT_FOLDER_ID?.trim();
  if (!root || !isSafeDriveId(root)) return null;
  return root;
}

/**
 * True when fileOrFolderId is the gallery root or a descendant of it.
 * Walks parents up to 25 levels (Drive folders are usually shallow).
 */
export async function isUnderGalleryRoot(
  fileOrFolderId: string
): Promise<boolean> {
  const rootId = getDriveGalleryRootId();
  if (!rootId || !isSafeDriveId(fileOrFolderId)) return false;
  if (fileOrFolderId === rootId) return true;

  const drive = getDriveClient();
  let current = fileOrFolderId;
  const seen = new Set<string>();

  for (let i = 0; i < 25; i++) {
    if (seen.has(current)) return false;
    seen.add(current);
    const meta = await drive.files.get({
      fileId: current,
      fields: "id,parents",
      supportsAllDrives: true,
    });
    const parents = meta.data.parents ?? [];
    if (parents.includes(rootId)) return true;
    if (parents.length === 0) return false;
    current = parents[0] as string;
  }
  return false;
}
