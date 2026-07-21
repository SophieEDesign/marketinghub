/**
 * Historical monthly web enquiry totals (Jan–Sep) from P&M chart
 * `PM_Monthly_Enquiries_Line_2023-2025.png` (generated Sep 2025).
 * Oct–Dec are unknown for these years (null → shown as —).
 * Live hub rows override overlapping months when present.
 */
export const HISTORICAL_MONTHLY_ENQUIRIES: Record<
  number,
  (number | null)[]
> = {
  2023: [88, 139, 102, 90, 76, 80, 78, 83, 90, null, null, null],
  2024: [13, 149, 128, 115, 148, 132, 130, 161, 149, null, null, null],
  2025: [133, 129, 103, 125, 141, 134, 165, 164, 157, null, null, null],
};

/** Years always shown in the enquiry history table. */
export const ENQUIRY_HISTORY_BASE_YEARS = [2023, 2024, 2025] as const;
