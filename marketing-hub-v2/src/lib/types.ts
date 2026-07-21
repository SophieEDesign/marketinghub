export type UserRole = "admin" | "staff" | "media_guest";

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
};

/** Hub access directory roles (Admin → Users). */
export type HubAccessRole = "admin" | "member" | "external";

export type HubUser = {
  id: string;
  email: string;
  full_name: string;
  role: HubAccessRole;
  notes: string;
  /** Present when loaded from Supabase Auth. */
  last_sign_in_at?: string | null;
  /** Null until the user accepts invite / confirms email (Supabase). */
  email_confirmed_at?: string | null;
  /** Set when an invite was sent (Supabase). */
  invited_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type EventItem = {
  id: string;
  title: string;
  /** Null when the date still needs adding (not shown on calendar). */
  starts_at: string | null;
  ends_at: string | null;
  location: string;
  event_type: string;
  /** Business division (Racing, Commercial, Leisure, …) */
  division: string;
  notes: string;
  link_url: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Per-user RSVP for an event (logged-in staff). */
export type EventAttendanceStatus =
  | "attending"
  | "maybe"
  | "not_attending"
  | "interested";

export type EventAttendance = {
  id: string;
  event_id: string;
  user_id: string;
  /** Display name captured at RSVP time. */
  user_name: string;
  attendance_status: EventAttendanceStatus;
  created_at: string;
  updated_at: string;
};

export type ContentStatus =
  | "idea"
  | "draft"
  | "review"
  | "scheduled"
  | "published";

export type ContentItem = {
  id: string;
  title: string;
  /** Platforms / outlets (LinkedIn, Instagram, …) — one or more */
  channel: string[];
  /** Kind of piece from source post_type (Social, Editorial, Newsletter, …) */
  content_type: string;
  owner: string;
  /** Publish / go-live date (calendar) */
  due_date: string | null;
  /** Optional internal deadline (Content table date_due) */
  deadline_date: string | null;
  status: ContentStatus;
  category: string;
  priority: string;
  website: string;
  /** Social caption / post copy (Content table content_post_text) */
  caption: string;
  /** Linked quarterly theme (content lives here; Themes page may still use mains for tree). */
  theme_id: string | null;
  planable_url: string;
  asset_url: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type SponsorshipStatus =
  | "prospect"
  | "negotiating"
  | "confirmed"
  | "active"
  | "complete"
  | "declined";

/** Sponsorship packages or industry memberships — both live under Partners. */
export type PartnerKind = "sponsorship" | "membership";

export type Sponsorship = {
  id: string;
  kind: PartnerKind;
  partner: string;
  package_name: string;
  starts_at: string | null;
  ends_at: string | null;
  value: string;
  status: SponsorshipStatus;
  deliverables: string;
  owner: string;
  onedrive_url: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type Contact = {
  id: string;
  name: string;
  organisation: string;
  role: string;
  email: string;
  phone: string;
  tags: string[];
  notes: string;
  /** Hub user (auth) linked to this contact — members edit only their linked record. */
  user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ResourceLink = {
  id: string;
  title: string;
  description: string;
  url: string;
  category: string;
  created_at: string;
  updated_at: string;
};

/** External reporting dashboards (GA, Ads, SE Ranking, Looker Studio, etc.) */
export type ReportLink = {
  id: string;
  title: string;
  description: string;
  url: string;
  category: string;
  tool: string;
  created_at: string;
  updated_at: string;
};

/** Quarterly planning spine: Theme → main content → offshoot content */
export type ThemeStatus = "previous" | "active" | "upcoming";

export type QuarterlyTheme = {
  id: string;
  title: string;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  year: number;
  status: ThemeStatus;
  summary: string;
  created_at: string;
  updated_at: string;
};

export type ThemeMainContent = {
  id: string;
  theme_id: string;
  /** Linked row in the Content table (attachments, due date, Planable, etc.) */
  content_id: string | null;
  title: string;
  channel: string;
  owner: string;
  status: ContentStatus;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type ThemeOffshoot = {
  id: string;
  main_content_id: string;
  title: string;
  channel: string;
  owner: string;
  status: ContentStatus;
  notes: string;
  created_at: string;
  updated_at: string;
};

/** Internal branded clothing / merchandise requests */
export type MerchStatus =
  | "requested"
  | "approved"
  | "ordered"
  | "delivered"
  | "cancelled";

export type MerchOrder = {
  id: string;
  item: string;
  /** Male or female cut */
  fit: "male" | "female" | "";
  size: string;
  quantity: number;
  colour: string;
  /** Embroidered / printed logo variant */
  logo: string;
  requested_for: string;
  office: string;
  needed_by: string | null;
  status: MerchStatus;
  notes: string;
  created_by: string;
  /** Auth user id of the requester — members only see their own. */
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

/** On-hand corporate clothing / kit stock */
export type MerchInventoryItem = {
  id: string;
  item: string;
  brand: string;
  /** Male or female cut; empty for unisex / accessories */
  fit: "male" | "female" | "";
  size: string;
  colour: string;
  quantity: number;
  /** Optional photo of the stock item */
  image_url: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

/** Internal staff requests (assets, social forms, etc.) */
export type StaffRequestKind = "asset" | "social_form" | "other";
export type StaffRequestStatus = "open" | "in_progress" | "done";

export type StaffRequest = {
  id: string;
  kind: StaffRequestKind;
  /** Asset type for kind=asset (Presentation, Brochure, Image, …) */
  category: string;
  title: string;
  details: string;
  requested_by: string;
  needed_by: string | null;
  /** Uploaded reference file / draft asset URL */
  attachment_url: string;
  status: StaffRequestStatus;
  created_at: string;
  updated_at: string;
};

/** Industry awards — entries, shortlists, wins */
export type AwardStatus =
  | "watching"
  | "entering"
  | "submitted"
  | "shortlisted"
  | "won"
  | "not_won";

export type AwardEntry = {
  id: string;
  title: string;
  organisation: string;
  category: string;
  year: number;
  status: AwardStatus;
  ceremony_at: string | null;
  owner: string;
  event_id: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

/** Marketing to-dos — status values come from Field Manager options. */
export type TaskStatus = string;

/** Optional link from a task to another hub record. */
export type TaskRelatedType =
  | "content"
  | "theme"
  | "sponsorship"
  | "award"
  | "event";

export type HubTask = {
  id: string;
  title: string;
  details: string;
  due_date: string | null;
  category: string;
  status: TaskStatus;
  owner: string;
  /** Linked record kind — empty/null when unlinked. */
  related_type: TaskRelatedType | "";
  related_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Public access requests (login → Request access). Managed under Admin → Users. */
export type AccessRequestStatus = "pending" | "approved" | "denied" | "failed";

export type AccessRequest = {
  id: string;
  full_name: string;
  email: string;
  /** member only on auto P&M path; public form otherwise always external */
  requested_role: "member" | "external";
  organisation: string;
  reason: string;
  status: AccessRequestStatus;
  decided_role?: "member" | "external" | null;
  decided_at?: string | null;
  decided_by?: string | null;
  error_message?: string;
  created_at: string;
  updated_at: string;
};

/** WordPress Quote Builder → hub webhook enquiries. */
export type WebEnquiryStatus = "new" | "in_progress" | "done";

export type WebEnquiry = {
  id: string;
  submission_id: string;
  created_at: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_country: string;
  final_service_category: string;
  user_selected_service: string;
  collection_location: string;
  delivery_location: string;
  selected_office: string;
  office_email: string;
  needs_manual_review: boolean;
  marketing_emails_consent: boolean;
  routing_reason: string;
  is_test: boolean;
  status: WebEnquiryStatus;
  make_fields: Record<string, unknown>;
  raw_payload: Record<string, unknown>;
  received_at: string;
  updated_at: string;
};

/** Singleton page reference notes (HTML), keyed by page id. */
export type HubPageNotes = {
  social_monthly_plan?: string;
};

/** Field Manager overrides (labels, types, select/tags option order). */
export type HubStoredFieldDef = {
  key: string;
  label: string;
  type: string;
  options?: { value: string; label: string }[];
  custom?: boolean;
};

export type HubFieldExtras = Partial<Record<string, HubStoredFieldDef[]>>;

export type HubStore = {
  events: EventItem[];
  /** Per-user RSVP rows for Events. */
  event_attendance: EventAttendance[];
  content: ContentItem[];
  sponsorships: Sponsorship[];
  contacts: Contact[];
  resources: ResourceLink[];
  reports: ReportLink[];
  themes: QuarterlyTheme[];
  theme_mains: ThemeMainContent[];
  theme_offshoots: ThemeOffshoot[];
  merch_orders: MerchOrder[];
  merch_inventory: MerchInventoryItem[];
  staff_requests: StaffRequest[];
  awards: AwardEntry[];
  tasks: HubTask[];
  /** Access directory — managed under Admin → Users, not data tables. */
  hub_users: HubUser[];
  /** Login access requests — managed under Admin → Users. */
  access_requests: AccessRequest[];
  /** Shared page reference notes (not a spreadsheet collection). */
  page_notes: HubPageNotes;
  /**
   * Field Manager schema extras — durable with the rest of hub_store so
   * option order / custom fields reach page views across deploys.
   */
  field_extras: HubFieldExtras;
};
