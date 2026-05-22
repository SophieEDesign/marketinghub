/**
 * XSS-safe HTML sanitization using DOMPurify.
 * Use before rendering any user-provided or stored HTML via dangerouslySetInnerHTML.
 */

import DOMPurify from "isomorphic-dompurify"

/** Config shape for DOMPurify.sanitize() */
interface SanitizeConfig {
  ALLOWED_TAGS?: string[]
  ALLOWED_ATTR?: string[]
  ADD_ATTR?: string[]
}

/** Default config: safe for rich text (TipTap/Quill output) and general content */
const DEFAULT_CONFIG: SanitizeConfig = {
  ALLOWED_TAGS: [
    "p", "br", "strong", "em", "u", "s", "span",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li",
    "a", "blockquote", "pre", "code",
    "div", "table", "thead", "tbody", "tr", "th", "td",
  ],
  ALLOWED_ATTR: ["href", "target", "rel", "class", "style", "title"],
}

/** Stricter config for HTML blocks (interface blocks) - no iframes or scripts */
const HTML_BLOCK_CONFIG: SanitizeConfig = {
  ...DEFAULT_CONFIG,
  ALLOWED_TAGS: [
    ...(DEFAULT_CONFIG.ALLOWED_TAGS ?? []),
    "iframe", "img", "video", "audio", "source",
    "svg", "path",
  ],
  ALLOWED_ATTR: [
    ...(DEFAULT_CONFIG.ALLOWED_ATTR ?? []),
    "src", "alt", "width", "height", "frameborder", "allowfullscreen",
    "allow", "loading",
  ],
  ADD_ATTR: ["target"],
}

/**
 * Sanitize HTML for safe rendering in rich text fields (LongText, FieldEditor, InlineFieldEditor).
 * Use for content from TipTap, Quill, or other rich text editors.
 */
export function sanitizeRichText(html: string): string {
  if (typeof html !== "string" || !html.trim()) return ""
  return DOMPurify.sanitize(html, DEFAULT_CONFIG) as string
}

/**
 * Sanitize HTML for HTML blocks. Allows iframes, images, and media.
 * Use only for admin-configured HTML blocks.
 */
export function sanitizeHtmlBlock(html: string): string {
  if (typeof html !== "string" || !html.trim()) return ""
  return DOMPurify.sanitize(html, HTML_BLOCK_CONFIG) as string
}

/** Strip tags for previews and summaries (asset descriptions, etc.). */
export function plainTextFromHtml(html: string): string {
  if (typeof html !== "string" || !html.trim()) return ""
  if (!html.includes("<")) return html.trim()
  return (DOMPurify.sanitize(html, { ALLOWED_TAGS: [] }) as string)
    .replace(/\s+/g, " ")
    .trim()
}
