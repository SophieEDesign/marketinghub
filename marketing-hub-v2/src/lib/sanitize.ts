/**
 * XSS-safe HTML sanitization for rich text fields (server / editor save path).
 */

import DOMPurify from "isomorphic-dompurify";
import { isRichTextEmpty, plainTextFromHtml } from "@/lib/plain-text";

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

export { plainTextFromHtml, isRichTextEmpty };
