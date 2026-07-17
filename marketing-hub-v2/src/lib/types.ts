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

export type ContentStatus =
  | "idea"
  | "draft"
  | "review"
  | "scheduled"
  | "published";

export type ContentItem = {
  id: string;
  title: string;
  /** Platform / outlet (LinkedIn, Editorial, …) */
  channel: string;
  /** Kind of piece from source post_type (Social, Editorial, Newsletter, …) */
  content_type: string;
  owner: string;
  due_date: string | null;
  status: ContentStatus;
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
  title: string;
  details: string;
  requested_by: string;
  needed_by: string | null;
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

/** Marketing to-dos (from Supabase Tasks table) */
export type TaskStatus = "todo" | "doing" | "done";

export type HubTask = {
  id: string;
  title: string;
  details: string;
  due_date: string | null;
  category: string;
  status: TaskStatus;
  owner: string;
  created_at: string;
  updated_at: string;
};

export type HubStore = {
  events: EventItem[];
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
};
