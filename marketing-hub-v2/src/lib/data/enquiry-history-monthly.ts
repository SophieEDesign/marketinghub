/**
 * Historical monthly web enquiry totals from P&M year-on-year series
 * (aligned with Portal `web_enquiry_monthly_stats`).
 * Live hub rows override overlapping months when present.
 */
export const HISTORICAL_MONTHLY_ENQUIRIES: Record<
  number,
  (number | null)[]
> = {
  2023: [88, 139, 102, 90, 76, 80, 78, 83, 90, 78, 63, 57],
  2024: [13, 149, 128, 115, 148, 132, 130, 161, 149, 151, 97, 160],
  2025: [133, 129, 103, 125, 141, 134, 165, 164, 163, 150, 117, 96],
};

/** Years always shown in the enquiry history table. */
export const ENQUIRY_HISTORY_BASE_YEARS = [2023, 2024, 2025] as const;
