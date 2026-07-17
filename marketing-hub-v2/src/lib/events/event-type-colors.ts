/** Event type colours for Events calendar (distinct from division pills). */

export type EventColor = { bg: string; border: string; text: string };

export const EVENT_TYPE_COLORS: Record<string, EventColor> = {
  "Trade show": { bg: "#2a8f9e", border: "#1f7380", text: "#ffffff" },
  Awards: { bg: "#c47a2c", border: "#a36320", text: "#ffffff" },
  Conference: { bg: "#4a6fa5", border: "#3a5984", text: "#ffffff" },
  Sponsorship: { bg: "#8b5a6b", border: "#6e4654", text: "#ffffff" },
  Commercial: { bg: "#0b3a4a", border: "#082f3c", text: "#ffffff" },
  Meeting: { bg: "#5b6ee1", border: "#4a5bc4", text: "#ffffff" },
  Internal: { bg: "#5b6b76", border: "#4a5761", text: "#ffffff" },
  Event: { bg: "#3d8b5c", border: "#2f6e49", text: "#ffffff" },
};

const FALLBACK: EventColor = { bg: "#64748b", border: "#475569", text: "#ffffff" };

const PALETTE: EventColor[] = [
  { bg: "#0ea5e9", border: "#0284c7", text: "#ffffff" },
  { bg: "#14b8a6", border: "#0f766e", text: "#ffffff" },
  { bg: "#a855f7", border: "#7e22ce", text: "#ffffff" },
  { bg: "#f59e0b", border: "#d97706", text: "#ffffff" },
  { bg: "#ef4444", border: "#dc2626", text: "#ffffff" },
];

function hashType(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function normalizeEventTypeLabel(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return "Event";
  const known = Object.keys(EVENT_TYPE_COLORS).find(
    (k) => k.toLowerCase() === s.toLowerCase()
  );
  return known ?? s;
}

export function eventTypeColor(eventType: string | null | undefined): EventColor {
  const key = normalizeEventTypeLabel(eventType);
  if (EVENT_TYPE_COLORS[key]) return EVENT_TYPE_COLORS[key];
  return PALETTE[hashType(key) % PALETTE.length] ?? FALLBACK;
}
