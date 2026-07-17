"use client";

import { sanitizeRichText, isRichTextEmpty, plainTextFromHtml } from "@/lib/sanitize";
import { cn } from "@/lib/utils";

type RichTextViewProps = {
  html: string | null | undefined;
  className?: string;
  empty?: string;
  /** When true, show plain truncated text (cards / lists). */
  plain?: boolean;
  clampLines?: 1 | 2 | 3;
};

/**
 * Safely render stored rich-text HTML (or plain preview).
 */
export function RichTextView({
  html,
  className,
  empty = "—",
  plain = false,
  clampLines,
}: RichTextViewProps) {
  if (isRichTextEmpty(html)) {
    return <span className={cn("text-muted", className)}>{empty}</span>;
  }

  if (plain || clampLines) {
    const text = plainTextFromHtml(html!);
    return (
      <span
        className={cn(
          className,
          clampLines === 1 && "line-clamp-1",
          clampLines === 2 && "line-clamp-2",
          clampLines === 3 && "line-clamp-3"
        )}
      >
        {text}
      </span>
    );
  }

  const safe = sanitizeRichText(html!);
  return (
    <div
      className={cn("prose-hub max-w-none text-sm text-foreground/90", className)}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
