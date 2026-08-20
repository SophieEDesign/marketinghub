"use client";

import dynamic from "next/dynamic";

/**
 * TipTap is heavy — load the editor only when a drawer/form mounts it.
 * Call sites keep importing `RichTextEditor` unchanged.
 */
export const RichTextEditor = dynamic(
  () =>
    import("./RichTextEditorImpl").then((m) => ({
      default: m.RichTextEditorImpl,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="field flex items-center text-sm text-muted" style={{ minHeight: 96 }}>
        Loading editor…
      </div>
    ),
  }
);
