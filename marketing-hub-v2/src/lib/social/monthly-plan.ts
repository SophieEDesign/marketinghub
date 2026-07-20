/** HubStore page_notes key for the social calendar monthly cadence. */
export const SOCIAL_MONTHLY_PLAN_KEY = "social_monthly_plan" as const;

export type PageNoteKey = typeof SOCIAL_MONTHLY_PLAN_KEY;

export const PAGE_NOTE_KEYS: PageNoteKey[] = [SOCIAL_MONTHLY_PLAN_KEY];

/** Default rough monthly posting plan shown until an admin saves a custom version. */
export const DEFAULT_SOCIAL_MONTHLY_PLAN_HTML = `
<ul>
  <li><strong>Monday</strong> — Insights, carousels, thought leadership</li>
  <li><strong>Tuesday</strong> — Event attendance and promotion</li>
  <li><strong>Wednesday</strong> — Testimonial (one per month) and miscellaneous</li>
  <li><strong>Thursday</strong> — Sailing schedule / route promotion</li>
  <li><strong>Friday</strong> — Drone footage, shipping updates, etc.</li>
</ul>
<p><strong>Also</strong></p>
<ul>
  <li>Employee spotlight — one per month</li>
  <li>Feature a week — rotate Racing, Commercial, Forwarding, Leisure</li>
</ul>
`.trim();
