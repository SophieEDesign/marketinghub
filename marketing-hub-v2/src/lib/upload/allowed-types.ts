/**
 * Shared asset upload allowlist — keep API routes and file pickers in sync.
 * Still blocks SVG/HTML/executables (XSS / malware risk).
 */

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const ALLOWED_UPLOAD_MIME = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  // Documents
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/csv",
  "text/rtf",
  "application/rtf",
  // Word
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  // Excel
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroenabled.12",
  // PowerPoint
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // OpenDocument
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  // Archives / design packages
  "application/zip",
  "application/x-zip-compressed",
  // Video
  "video/mp4",
  "video/quicktime",
]);

/** Extension fallback when browsers send empty / octet-stream MIME. */
export const ALLOWED_UPLOAD_EXT =
  /\.(png|jpe?g|gif|webp|pdf|mp4|mov|docx?|xlsx?|pptx?|csv|txt|rtf|odt|ods|odp|zip)$/i;

/** HTML file input `accept` — MIME + extensions for broader picker support. */
export const UPLOAD_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip,video/mp4,video/quicktime,.jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.rtf,.odt,.ods,.odp,.zip,.mp4,.mov";

export const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".csv": "text/csv",
  ".txt": "text/plain",
  ".rtf": "application/rtf",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".ods": "application/vnd.oasis.opendocument.spreadsheet",
  ".odp": "application/vnd.oasis.opendocument.presentation",
  ".zip": "application/zip",
};

const FORCE_DOWNLOAD_EXT = new Set([
  ".pdf",
  ".mp4",
  ".mov",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".csv",
  ".txt",
  ".rtf",
  ".odt",
  ".ods",
  ".odp",
  ".zip",
]);

export function isBlockedUpload(name: string, type?: string) {
  return type === "image/svg+xml" || /\.svg$/i.test(name);
}

export function isAllowedUpload(name: string, type?: string) {
  if (isBlockedUpload(name, type)) return false;
  const mime = type || "";
  if (mime && ALLOWED_UPLOAD_MIME.has(mime)) return true;
  // Broad image/* (except SVG) for paste/screenshots
  if (mime.startsWith("image/") && mime !== "image/svg+xml") return true;
  return ALLOWED_UPLOAD_EXT.test(name);
}

export function isForcedDownloadExt(ext: string) {
  return FORCE_DOWNLOAD_EXT.has(ext.toLowerCase());
}
