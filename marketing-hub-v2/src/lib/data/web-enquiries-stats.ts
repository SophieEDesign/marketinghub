import type { WebEnquiry } from "@/lib/types";

export type WebEnquiryStats = {
  thisWeek: number;
  thisMonth: number;
  total: number;
  needsReview: number;
  googleAds: number;
  topSources: { label: string; count: number }[];
  byOffice: { label: string; count: number }[];
  /** Google Ads / Google enquiries grouped by referrer link. */
  googleAdsByReferrer: { label: string; count: number }[];
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

/** Raw referrer URL from tracking / make / form fields. */
export function enquiryReferrerRaw(e: WebEnquiry): string {
  const raw = asRecord(e.raw_payload);
  const tracking = asRecord(raw.tracking);
  const make = asRecord(e.make_fields);
  const form = asRecord(raw.form_fields);
  return (
    asString(tracking.referrer) ||
    asString(make.referrer) ||
    asString(form.referrer) ||
    asString(form.Referrer) ||
    ""
  ).trim();
}

/**
 * Grouping key for referrer links — strips hash/query noise where possible,
 * keeps host + path so Ad landing variants still group sensibly.
 */
export function enquiryReferrerKey(e: WebEnquiry): string {
  const raw = enquiryReferrerRaw(e);
  if (!raw) return "No referrer";
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(withProto);
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return `${u.hostname}${path === "/" ? "" : path}`;
  } catch {
    return raw.slice(0, 160);
  }
}

/** Short label for chips / tables. */
export function enquiryReferrerLabel(key: string, max = 48): string {
  if (key === "No referrer") return key;
  if (key.length <= max) return key;
  return `${key.slice(0, max - 1)}…`;
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
  const adsReferrerCounts = new Map<string, number>();

  for (const e of list) {
    const t = enquiryDate(e);
    if (t) {
      if (t >= weekAgo) thisWeek += 1;
      if (t >= monthStart) thisMonth += 1;
    }
    if (e.needs_manual_review) needsReview += 1;
    if (isGoogleAdsEnquiry(e)) {
      googleAds += 1;
      const ref = enquiryReferrerKey(e);
      adsReferrerCounts.set(ref, (adsReferrerCounts.get(ref) ?? 0) + 1);
    }

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

  const googleAdsByReferrer = [...adsReferrerCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return {
    thisWeek,
    thisMonth,
    total: list.length,
    needsReview,
    googleAds,
    topSources,
    byOffice,
    googleAdsByReferrer,
  };
}

export const ENQUIRY_MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export type EnquiryYearCompare = {
  years: number[];
  /** [monthIndex 0–11][yearIndex] count */
  months: number[][];
  /** Latest year with any data — used for Δ / % vs prior year. */
  compareYear: number | null;
  priorYear: number | null;
  /** Months (0–11) that have data in compareYear (or all past months of current calendar year). */
  ytdMonthIndexes: number[];
  ytdTotals: Record<number, number>;
  ytdDelta: number | null;
  ytdPct: number | null;
};

function pctChange(current: number, prior: number): number | null {
  if (prior === 0) return current === 0 ? 0 : null;
  return ((current - prior) / prior) * 100;
}

/**
 * Month × year matrix for enquiries. Ignores page date filters — uses the full list
 * (caller should already apply test-row visibility).
 */
export function computeEnquiryYearCompare(
  items: WebEnquiry[],
  opts?: { includeTest?: boolean; now?: Date }
): EnquiryYearCompare {
  const list = opts?.includeTest ? items : items.filter((e) => !e.is_test);
  const now = opts?.now ?? new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const counts = new Map<number, number[]>();
  for (const e of list) {
    const d = enquiryDate(e);
    if (!d) continue;
    const y = d.getFullYear();
    const m = d.getMonth();
    if (!counts.has(y)) counts.set(y, Array.from({ length: 12 }, () => 0));
    counts.get(y)![m] += 1;
  }

  const years = [...counts.keys()].sort((a, b) => a - b);
  const months = Array.from({ length: 12 }, (_, month) =>
    years.map((y) => counts.get(y)?.[month] ?? 0)
  );

  const compareYear =
    years.filter((y) => y <= currentYear).at(-1) ?? years.at(-1) ?? null;
  const priorYear =
    compareYear != null
      ? [...years].reverse().find((y) => y < compareYear) ?? null
      : null;

  /** YTD = months through latest month that is “in” for compare year. */
  let ytdThrough = -1;
  if (compareYear != null) {
    if (compareYear === currentYear) {
      ytdThrough = currentMonth;
    } else {
      for (let m = 11; m >= 0; m -= 1) {
        if ((counts.get(compareYear)?.[m] ?? 0) > 0) {
          ytdThrough = m;
          break;
        }
      }
    }
  }

  const ytdMonthIndexes =
    ytdThrough >= 0 ? Array.from({ length: ytdThrough + 1 }, (_, i) => i) : [];

  const ytdTotals: Record<number, number> = {};
  for (const y of years) {
    ytdTotals[y] = ytdMonthIndexes.reduce(
      (sum, m) => sum + (counts.get(y)?.[m] ?? 0),
      0
    );
  }

  let ytdDelta: number | null = null;
  let ytdPct: number | null = null;
  if (compareYear != null && priorYear != null && ytdMonthIndexes.length > 0) {
    const cur = ytdTotals[compareYear] ?? 0;
    const prev = ytdTotals[priorYear] ?? 0;
    ytdDelta = cur - prev;
    ytdPct = pctChange(cur, prev);
  }

  return {
    years,
    months,
    compareYear,
    priorYear,
    ytdMonthIndexes,
    ytdTotals,
    ytdDelta,
    ytdPct,
  };
}

export function formatEnquiryDelta(delta: number | null): string {
  if (delta == null) return "—";
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

export function formatEnquiryPct(pct: number | null): string {
  if (pct == null) return "—";
  const rounded = Math.round(pct * 100) / 100;
  const body = `${Math.abs(rounded).toFixed(2)}%`;
  if (rounded > 0) return `+${body}`;
  if (rounded < 0) return `-${body}`;
  return body;
}
