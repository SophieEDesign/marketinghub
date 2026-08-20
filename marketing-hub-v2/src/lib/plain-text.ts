/** Lightweight HTML → plain text (safe for client bundles — no DOMPurify/jsdom). */
export function plainTextFromHtml(html: string): string {
  if (typeof html !== "string" || !html.trim()) return "";
  if (!html.includes("<")) return html.trim();

  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
  }

  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isRichTextEmpty(html: string | null | undefined): boolean {
  if (!html) return true;
  return !plainTextFromHtml(html);
}
