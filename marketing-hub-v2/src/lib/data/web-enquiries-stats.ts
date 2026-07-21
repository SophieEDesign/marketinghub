import type { WebEnquiry } from "@/lib/types";

export type WebEnquiryStats = {
  thisWeek: number;
  thisMonth: number;
  total: number;
  needsReview: number;
  googleAds: number;
  topSources: { label: string; count: number }[];
  byOffice: { label: string; count: number }[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

/** Heard-about / UTM / gclid helpers for attribution stats. */
export function enquirySourceLabel(e: WebEnquiry): string {
  const raw = asRecord(e.raw_payload);
  const tracking = asRecord(raw.tracking);
  const make = asRecord(e.make_fields);
  const form = asRecord(raw.form_fields);

  const gclid =
    asString(tracking.gclid) ||
    asString(make.gclid) ||
    asString(form.gclid);
  if (gclid) return "Google Ads";

  const utm =
    asString(tracking.utm_source) ||
    asString(make.utm_source) ||
    asString(form.utm_source);
  if (utm) {
    if (/google/i.test(utm)) return "Google Ads";
    return utm;
  }

  const heard =
    asString(tracking.heard_about) ||
    asString(make.heard_about) ||
    asString(form["How did you hear about us?"]);
  if (heard) {
    if (/google\s*ads?|paid\s*search|ppc/i.test(heard)) return "Google Ads";
    if (/google/i.test(heard)) return "Google";
    return heard;
  }

  return "Unknown";
}

export function isGoogleAdsEnquiry(e: WebEnquiry): boolean {
  const label = enquirySourceLabel(e);
  return label === "Google Ads" || label === "Google";
}

export function enquiryDate(e: WebEnquiry): Date | null {
  const raw = e.created_at || e.received_at;
  if (!raw) return null;
  const d = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Inclusive calendar-day filter (from/to as yyyy-MM-dd). */
export function enquiryInDateRange(
  e: WebEnquiry,
  from: string,
  to: string
): boolean {
  if (!from && !to) return true;
  const d = enquiryDate(e);
  if (!d) return false;
  if (from) {
    const start = new Date(`${from}T00:00:00`);
    if (d < start) return false;
  }
  if (to) {
    const end = new Date(`${to}T23:59:59.999`);
    if (d > end) return false;
  }
  return true;
}

/** Pure — safe to import from client components. */
export function computeEnquiryStats(
  items: WebEnquiry[],
  opts?: { includeTest?: boolean }
): WebEnquiryStats {
  const list = opts?.includeTest ? items : items.filter((e) => !e.is_test);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let thisWeek = 0;
  let thisMonth = 0;
  let needsReview = 0;
  let googleAds = 0;
  const sourceCounts = new Map<string, number>();
  const officeCounts = new Map<string, number>();

  for (const e of list) {
    const t = enquiryDate(e);
    if (t) {
      if (t >= weekAgo) thisWeek += 1;
      if (t >= monthStart) thisMonth += 1;
    }
    if (e.needs_manual_review) needsReview += 1;
    if (isGoogleAdsEnquiry(e)) googleAds += 1;

    const src = enquirySourceLabel(e);
    sourceCounts.set(src, (sourceCounts.get(src) ?? 0) + 1);

    const office = e.selected_office?.trim() || "Unassigned";
    officeCounts.set(office, (officeCounts.get(office) ?? 0) + 1);
  }

  const topSources = [...sourceCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const byOffice = [...officeCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  return {
    thisWeek,
    thisMonth,
    total: list.length,
    needsReview,
    googleAds,
    topSources,
    byOffice,
  };
}
