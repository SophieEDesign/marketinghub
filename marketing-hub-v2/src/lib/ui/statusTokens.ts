/** Semantic status colours for chips and calendar events — use instead of per-module hex maps. */

export type StatusToken =
  | "draft"
  | "idea"
  | "review"
  | "scheduled"
  | "published"
  | "won"
  | "lost"
  | "watching"
  | "todo"
  | "doing"
  | "done"
  | "new"
  | "in_progress"
  | "danger";

export const STATUS_STYLES: Record<
  StatusToken,
  { bg: string; text: string; border: string; event?: string }
> = {
  draft: {
    bg: "bg-accent-soft",
    text: "text-brand",
    border: "border-accent/30",
    event: "#2a8f9e",
  },
  idea: {
    bg: "bg-sand",
    text: "text-muted",
    border: "border-border",
    event: "#94a3b8",
  },
  review: {
    bg: "bg-accent-soft",
    text: "text-brand-soft",
    border: "border-accent/40",
    event: "#0d9488",
  },
  scheduled: {
    bg: "bg-sky-50",
    text: "text-sky-900",
    border: "border-sky-200",
    event: "#5b6ee1",
  },
  published: {
    bg: "bg-emerald-50",
    text: "text-emerald-900",
    border: "border-emerald-200",
    event: "#3d8b5c",
  },
  won: {
    bg: "bg-emerald-50",
    text: "text-emerald-900",
    border: "border-emerald-200",
    event: "#3d8b5c",
  },
  lost: {
    bg: "bg-red-50",
    text: "text-danger",
    border: "border-red-200",
    event: "#b42318",
  },
  watching: {
    bg: "bg-sand",
    text: "text-muted",
    border: "border-border",
    event: "#94a3b8",
  },
  todo: {
    bg: "bg-amber-50",
    text: "text-amber-900",
    border: "border-amber-200",
    event: "#d97706",
  },
  doing: {
    bg: "bg-sky-50",
    text: "text-sky-900",
    border: "border-sky-200",
    event: "#0284c7",
  },
  done: {
    bg: "bg-emerald-50",
    text: "text-emerald-900",
    border: "border-emerald-200",
    event: "#059669",
  },
  new: {
    bg: "bg-sky-50",
    text: "text-sky-900",
    border: "border-sky-200",
  },
  in_progress: {
    bg: "bg-amber-50",
    text: "text-amber-900",
    border: "border-amber-200",
  },
  danger: {
    bg: "bg-red-50",
    text: "text-danger",
    border: "border-red-200",
  },
};

export function resolveStatusToken(raw: string): StatusToken {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (s in STATUS_STYLES) return s as StatusToken;
  if (s.includes("publish")) return "published";
  if (s.includes("schedul")) return "scheduled";
  if (s.includes("approv") || s.includes("review")) return "review";
  if (s.includes("draft")) return "draft";
  if (s.includes("idea")) return "idea";
  if (s.includes("won")) return "won";
  if (s.includes("lost")) return "lost";
  if (s.includes("watch")) return "watching";
  if (s.includes("done") || s.includes("complete")) return "done";
  if (s.includes("doing") || s.includes("progress")) return "doing";
  if (s.includes("new")) return "new";
  return "draft";
}

export function statusChipClass(raw: string): string {
  const token = resolveStatusToken(raw);
  const style = STATUS_STYLES[token];
  return `${style.bg} ${style.text} ${style.border}`;
}

export function statusEventColor(raw: string): string {
  const token = resolveStatusToken(raw);
  return STATUS_STYLES[token].event ?? STATUS_STYLES.draft.event!;
}
