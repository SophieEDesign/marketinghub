import type { WebEnquiry } from "@/lib/types";

export type WebEnquiryStats = {
  thisWeek: number;
  thisMonth: number;
  total: number;
  needsReview: number;
  statusNew: number;
};

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
  let statusNew = 0;

  for (const e of list) {
    const t = e.created_at ? new Date(e.created_at) : new Date(e.received_at);
    if (!Number.isNaN(t.getTime())) {
      if (t >= weekAgo) thisWeek += 1;
      if (t >= monthStart) thisMonth += 1;
    }
    if (e.needs_manual_review) needsReview += 1;
    if (e.status === "new") statusNew += 1;
  }

  return {
    thisWeek,
    thisMonth,
    total: list.length,
    needsReview,
    statusNew,
  };
}
