/** Canonical Google Drive folder URL for a folder id. Safe for client + server. */
export function driveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`
}

/** Prefer Drive webViewLink when it targets a folder; otherwise build from id. */
export function resolveDriveFolderUrl(folderId: string, webViewLink?: string | null): string {
  if (webViewLink && /\/folders\/|\/drive\/u\/\d+\//.test(webViewLink)) {
    return webViewLink
  }
  return driveFolderUrl(folderId)
}
