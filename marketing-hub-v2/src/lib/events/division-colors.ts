/** Division colours — kept distinct from event-type colours in event-type-colors.ts. */
export const DIVISION_COLORS: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  All: { bg: "#1e293b", border: "#0f172a", text: "#ffffff" },
  Racing: { bg: "#0369a1", border: "#075985", text: "#ffffff" },
  Commercial: { bg: "#b45309", border: "#92400e", text: "#ffffff" },
  Leisure: { bg: "#15803d", border: "#166534", text: "#ffffff" },
  Forwarding: { bg: "#6d28d9", border: "#5b21b6", text: "#ffffff" },
  CMT: { bg: "#be185d", border: "#9d174d", text: "#ffffff" },
};

const FALLBACK = { bg: "#64748b", border: "#475569", text: "#ffffff" };

export function normalizeDivision(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  const known = Object.keys(DIVISION_COLORS).find(
    (k) => k.toLowerCase() === s.toLowerCase()
  );
  return known ?? s;
}

export function divisionColor(division: string | null | undefined) {
  const key = normalizeDivision(division);
  if (!key) return FALLBACK;
  return DIVISION_COLORS[key] ?? FALLBACK;
}

export const DIVISION_OPTIONS = [
  "All",
  "Racing",
  "Commercial",
  "Leisure",
  "Forwarding",
  "CMT",
] as const;
