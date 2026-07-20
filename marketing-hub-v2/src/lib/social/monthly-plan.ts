/** HubStore page_notes key for the social calendar monthly cadence. */
export const SOCIAL_MONTHLY_PLAN_KEY = "social_monthly_plan" as const;

export type PageNoteKey = typeof SOCIAL_MONTHLY_PLAN_KEY;

export const PAGE_NOTE_KEYS: PageNoteKey[] = [SOCIAL_MONTHLY_PLAN_KEY];

export const WEEK_LABELS = ["Week 1", "Week 2", "Week 3", "Week 4"] as const;

export type SocialMonthlyPlanRow = {
  day: string;
  theme: string;
  weeks: [string, string, string, string];
};

export type SocialMonthlyPlanMatrix = {
  version: 1;
  rows: SocialMonthlyPlanRow[];
};

/** Default weekday × week-of-month posting matrix. */
export const DEFAULT_SOCIAL_MONTHLY_PLAN: SocialMonthlyPlanMatrix = {
  version: 1,
  rows: [
    {
      day: "Mon",
      theme: "Insight / thought leadership",
      weeks: [
        "Industry insight / carousel",
        "Campaign story (hero article angle)",
        "Explainer / FAQ from the logistics question bank",
        "Milestone, award, or press pickup",
      ],
    },
    {
      day: "Tue",
      theme: "Events",
      weeks: [
        "Live event coverage (if on)",
        "Sponsorship spotlight (Admirals Cup, Cowes Week, Fountaine Pajot / Dufour)",
        "Live event coverage (if on)",
        "Partnership feature (Sailing Doodles, Briese)",
      ],
    },
    {
      day: "Wed",
      theme: "Testimonial / feature",
      weeks: [
        "Testimonial",
        "Division spotlight (Racing → Commercial → Forwarding → Leisure, rotating)",
        "Employee spotlight",
        "Customer FAQ / behind-the-scenes",
      ],
    },
    {
      day: "Thu",
      theme: "Route / schedule",
      weeks: [
        "Sailing schedule update",
        "Route promotion",
        "“Did you know” logistics fact",
        "Sailing schedule update",
      ],
    },
    {
      day: "Fri",
      theme: "Operational",
      weeks: [
        "Drone footage",
        "Shipping update",
        "Drone footage",
        "Shipping update / week wrap",
      ],
    },
  ],
};

/** @deprecated Prefer DEFAULT_SOCIAL_MONTHLY_PLAN — kept for API fallbacks. */
export const DEFAULT_SOCIAL_MONTHLY_PLAN_HTML = serializeMonthlyPlan(
  DEFAULT_SOCIAL_MONTHLY_PLAN
);

function isPlanRow(value: unknown): value is SocialMonthlyPlanRow {
  if (!value || typeof value !== "object") return false;
  const row = value as SocialMonthlyPlanRow;
  return (
    typeof row.day === "string" &&
    typeof row.theme === "string" &&
    Array.isArray(row.weeks) &&
    row.weeks.length === 4 &&
    row.weeks.every((cell) => typeof cell === "string")
  );
}

export function isMonthlyPlanMatrix(
  value: unknown
): value is SocialMonthlyPlanMatrix {
  if (!value || typeof value !== "object") return false;
  const plan = value as SocialMonthlyPlanMatrix;
  return (
    plan.version === 1 &&
    Array.isArray(plan.rows) &&
    plan.rows.length > 0 &&
    plan.rows.every(isPlanRow)
  );
}

export function serializeMonthlyPlan(plan: SocialMonthlyPlanMatrix): string {
  return JSON.stringify(plan);
}

export function parseMonthlyPlan(raw: string | null | undefined): SocialMonthlyPlanMatrix {
  if (!raw?.trim()) return DEFAULT_SOCIAL_MONTHLY_PLAN;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isMonthlyPlanMatrix(parsed)) return parsed;
  } catch {
    // Legacy HTML / plain text — fall back to default matrix.
  }
  return DEFAULT_SOCIAL_MONTHLY_PLAN;
}

export function cloneMonthlyPlan(
  plan: SocialMonthlyPlanMatrix
): SocialMonthlyPlanMatrix {
  return {
    version: 1,
    rows: plan.rows.map((row) => ({
      day: row.day,
      theme: row.theme,
      weeks: [...row.weeks] as [string, string, string, string],
    })),
  };
}
