/** Division colours for Events calendar / list (brand-adjacent, distinct). */
export const DIVISION_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  All: { bg: "#0b3a4a", border: "#0b3a4a", text: "#ffffff" },
  Racing: { bg: "#2a8f9e", border: "#1f7380", text: "#ffffff" },
  Commercial: { bg: "#c47a2c", border: "#a36320", text: "#ffffff" },
  Leisure: { bg: "#3d8b5c", border: "#2f6e49", text: "#ffffff" },
  Forwarding: { bg: "#4a6fa5", border: "#3a5984", text: "#ffffff" },
  CMT: { bg: "#8b5a6b", border: "#6e4654", text: "#ffffff" },
};

const FALLBACK = { bg: "#5b6b76", border: "#4a5761", text: "#ffffff" };

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
