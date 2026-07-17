/**
 * XSS-safe HTML sanitization for rich text fields.
 */

import DOMPurify from "isomorphic-dompurify";

const RICH_TEXT_CONFIG = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "s",
    "span",
    "h1",
    "h2",
    "h3",
    "h4",
    "ul",
    "ol",
    "li",
    "a",
    "blockquote",
    "pre",
    "code",
  ],
  ALLOWED_ATTR: ["href", "target", "rel", "class", "title"],
};

/** Sanitize TipTap / rich-text HTML before storage or render. */
export function sanitizeRichText(html: string): string {
  if (typeof html !== "string" || !html.trim()) return "";
  return DOMPurify.sanitize(html, RICH_TEXT_CONFIG) as string;
}

/** Empty TipTap document (or blank) → treat as empty string for storage. */
export function normalizeRichTextStorage(html: string): string {
  const cleaned = sanitizeRichText(html);
  if (!cleaned) return "";
  const plain = plainTextFromHtml(cleaned);
  return plain ? cleaned : "";
}

/** Strip tags for previews, search, ICS, channel detection. */
export function plainTextFromHtml(html: string): string {
  if (typeof html !== "string" || !html.trim()) return "";
  if (!html.includes("<")) return html.trim();
  return (DOMPurify.sanitize(html, { ALLOWED_TAGS: [] }) as string)
    .replace(/\s+/g, " ")
    .trim();
}

export function isRichTextEmpty(html: string | null | undefined): boolean {
  if (!html) return true;
  return !plainTextFromHtml(html);
}
