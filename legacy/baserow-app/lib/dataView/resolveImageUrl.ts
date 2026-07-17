/**
 * Resolve a previewable image URL from attachment / URL field cell values.
 */

function parseAttachmentItem(item: unknown): string | null {
  if (typeof item === "string") {
    const trimmed = item.trim()
    if (!trimmed) return null
    if (trimmed.startsWith("http") || trimmed.startsWith("/") || trimmed.startsWith("data:")) {
      return trimmed
    }
    return null
  }
  if (!item || typeof item !== "object") return null
  const obj = item as Record<string, unknown>
  const rawUrl = obj.url ?? obj.src ?? obj.href ?? obj.thumbnail ?? obj.file_url
  if (typeof rawUrl !== "string" || !rawUrl.trim()) return null
  const url = rawUrl.trim()
  if (!url.startsWith("http") && !url.startsWith("/") && !url.startsWith("data:")) return null
  return url
}

export function resolveImageUrlFromFieldValue(value: unknown): string | null {
  if (value == null || value === "") return null

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        return resolveImageUrlFromFieldValue(JSON.parse(trimmed))
      } catch {
        return parseAttachmentItem(trimmed)
      }
    }
    return parseAttachmentItem(trimmed)
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const url = parseAttachmentItem(item)
      if (url) return url
    }
    return null
  }

  if (typeof value === "object") {
    return parseAttachmentItem(value)
  }

  return null
}

export function isPreviewableImageUrl(url: string): boolean {
  const normalized = url.trim().toLowerCase()
  if (!normalized) return false
  if (normalized.startsWith("data:image/")) return true
  if (normalized.includes("/storage/v1/object/")) return true

  const path = normalized.split("?")[0]
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)$/i.test(path)
}
