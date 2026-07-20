/** HubStore page_notes key for the social calendar monthly cadence. */
export const SOCIAL_MONTHLY_PLAN_KEY = "social_monthly_plan" as const;

export type PageNoteKey = typeof SOCIAL_MONTHLY_PLAN_KEY;

export const PAGE_NOTE_KEYS: PageNoteKey[] = [SOCIAL_MONTHLY_PLAN_KEY];

/** Default rough monthly posting plan shown until an admin saves a custom version. */
export const DEFAULT_SOCIAL_MONTHLY_PLAN_HTML = `
<p><strong>Mon — Insight / thought leadership</strong></p>
<ul>
  <li><strong>Week 1</strong> — Industry insight / carousel</li>
  <li><strong>Week 2</strong> — Campaign story (hero article angle)</li>
  <li><strong>Week 3</strong> — Explainer / FAQ from the logistics question bank</li>
  <li><strong>Week 4</strong> — Milestone, award, or press pickup</li>
</ul>
<p><strong>Tue — Events</strong></p>
<ul>
  <li><strong>Week 1</strong> — Live event coverage (if on)</li>
  <li><strong>Week 2</strong> — Sponsorship spotlight (Admirals Cup, Cowes Week, Fountaine Pajot / Dufour)</li>
  <li><strong>Week 3</strong> — Live event coverage (if on)</li>
  <li><strong>Week 4</strong> — Partnership feature (Sailing Doodles, Briese)</li>
</ul>
<p><strong>Wed — Testimonial / feature</strong></p>
<ul>
  <li><strong>Week 1</strong> — Testimonial</li>
  <li><strong>Week 2</strong> — Division spotlight (Racing → Commercial → Forwarding → Leisure, rotating)</li>
  <li><strong>Week 3</strong> — Employee spotlight</li>
  <li><strong>Week 4</strong> — Customer FAQ / behind-the-scenes</li>
</ul>
<p><strong>Thu — Route / schedule</strong></p>
<ul>
  <li><strong>Week 1</strong> — Sailing schedule update</li>
  <li><strong>Week 2</strong> — Route promotion</li>
  <li><strong>Week 3</strong> — “Did you know” logistics fact</li>
  <li><strong>Week 4</strong> — Sailing schedule update</li>
</ul>
<p><strong>Fri — Operational</strong></p>
<ul>
  <li><strong>Week 1</strong> — Drone footage</li>
  <li><strong>Week 2</strong> — Shipping update</li>
  <li><strong>Week 3</strong> — Drone footage</li>
  <li><strong>Week 4</strong> — Shipping update / week wrap</li>
</ul>
`.trim();
