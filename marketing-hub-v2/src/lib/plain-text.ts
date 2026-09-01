function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

/** Plain text / legacy caption → TipTap-friendly HTML paragraphs. */
export function plainTextToEditorHtml(value: string): string {
  if (typeof value !== "string" || !value.trim()) return "";
  if (looksLikeHtml(value)) return value;
  return value
    .split(/\r?\n/)
    .map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`)
    .join("");
}

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
