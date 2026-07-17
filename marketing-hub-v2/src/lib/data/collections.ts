import type { HubStore } from "@/lib/types";

/** Spreadsheet collections — excludes users/access requests (Admin → Users). */
export type CollectionKey = Exclude<
  keyof HubStore,
  "hub_users" | "access_requests" | "event_attendance"
>;

export type FieldType =
  | "text"
  | "longtext"
  | "number"
  | "date"
  | "datetime"
  | "url"
  | "email"
  | "select"
  | "tags"
  | "readonly";

export type FieldOption = { value: string; label: string };

export type FieldOptionsSource = "contacts";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  options?: FieldOption[];
  /** Dynamic options resolved at table load (e.g. owner → contacts). */
  optionsSource?: FieldOptionsSource;
  /** Protect from delete / edit */
  locked?: boolean;
};

export type CollectionDef = {
  key: CollectionKey;
  label: string;
  description: string;
  fields: FieldDef[];
};

const CONTENT_STATUS: FieldOption[] = [
  { value: "idea", label: "Idea" },
  { value: "draft", label: "Draft" },
  { value: "review", label: "Review" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
];

const PARTNER_STATUS: FieldOption[] = [
  { value: "prospect", label: "Prospect" },
  { value: "negotiating", label: "Negotiating" },
  { value: "confirmed", label: "Confirmed" },
  { value: "active", label: "Active" },
  { value: "complete", label: "Complete" },
  { value: "declined", label: "Declined" },
];

const AWARD_STATUS: FieldOption[] = [
  { value: "watching", label: "Watching" },
  { value: "entering", label: "Entering" },
  { value: "submitted", label: "Submitted" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "won", label: "Won" },
  { value: "not_won", label: "Not won" },
];

const MERCH_STATUS: FieldOption[] = [
  { value: "requested", label: "Requested" },
  { value: "approved", label: "Approved" },
  { value: "ordered", label: "Ordered" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const THEME_STATUS: FieldOption[] = [
  { value: "previous", label: "Previous" },
  { value: "active", label: "Active" },
  { value: "upcoming", label: "Upcoming" },
];

const STAFF_REQUEST_STATUS: FieldOption[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

export const EVENT_TYPES: FieldOption[] = [
  { value: "Trade show", label: "Trade show" },
  { value: "Commercial", label: "Commercial" },
  { value: "Awards", label: "Awards" },
  { value: "Conference", label: "Conference" },
  { value: "Sponsorship", label: "Sponsorship" },
  { value: "Meeting", label: "Meeting" },
  { value: "Internal", label: "Internal" },
  { value: "Event", label: "Event" },
];

export const CHANNELS: FieldOption[] = [
  { value: "LinkedIn", label: "LinkedIn" },
  { value: "Instagram", label: "Instagram" },
  { value: "Facebook", label: "Facebook" },
  { value: "X", label: "X" },
  { value: "TikTok", label: "TikTok" },
  { value: "YouTube", label: "YouTube" },
  { value: "Newsletter", label: "Newsletter" },
  { value: "Editorial", label: "Editorial" },
  { value: "PR", label: "PR" },
  { value: "Article", label: "Article" },
  { value: "Sponsorship", label: "Sponsorship" },
  { value: "Case study", label: "Case study" },
];

export const CONTENT_TYPES: FieldOption[] = [
  { value: "Social", label: "Social" },
  { value: "Editorial", label: "Editorial" },
  { value: "Newsletter", label: "Newsletter" },
  { value: "Sponsorship", label: "Sponsorship" },
  { value: "PR", label: "PR" },
];

export const TASK_CATEGORIES: FieldOption[] = [
  { value: "Events", label: "Events" },
  { value: "Website", label: "Website" },
  { value: "Content", label: "Content" },
  { value: "Social", label: "Social" },
  { value: "Press", label: "Press" },
  { value: "Partners", label: "Partners" },
  { value: "Admin", label: "Admin" },
];

export const RESOURCE_CATEGORIES: FieldOption[] = [
  { value: "Brand", label: "Brand" },
  { value: "Press", label: "Press" },
  { value: "Web", label: "Web" },
  { value: "Templates", label: "Templates" },
  { value: "General", label: "General" },
];

export const REPORT_CATEGORIES: FieldOption[] = [
  { value: "Website", label: "Website" },
  { value: "Ads", label: "Ads" },
  { value: "SEO", label: "SEO" },
  { value: "Enquiries", label: "Enquiries" },
  { value: "Social", label: "Social" },
  { value: "Dashboards", label: "Dashboards" },
];

export const REPORT_TOOLS: FieldOption[] = [
  { value: "Google Analytics", label: "Google Analytics" },
  { value: "Google Ads", label: "Google Ads" },
  { value: "SE Ranking", label: "SE Ranking" },
  { value: "Looker Studio", label: "Looker Studio" },
  { value: "Enquiries", label: "Enquiries" },
  { value: "Other", label: "Other" },
];

const QUARTERS: FieldOption[] = [
  { value: "Q1", label: "Q1" },
  { value: "Q2", label: "Q2" },
  { value: "Q3", label: "Q3" },
  { value: "Q4", label: "Q4" },
];

const MERCH_SIZES: FieldOption[] = [
  { value: "XS", label: "XS" },
  { value: "S", label: "S" },
  { value: "M", label: "M" },
  { value: "L", label: "L" },
  { value: "XL", label: "XL" },
  { value: "XXL", label: "XXL" },
  { value: "3XL", label: "3XL" },
];

const MERCH_ITEMS: FieldOption[] = [
  { value: "Polo — Regatta (polyester)", label: "Polo — Regatta (polyester)" },
  { value: "Polo — Pique (cotton)", label: "Polo — Pique (cotton)" },
  { value: "Polo — Tactel", label: "Polo — Tactel" },
  { value: "Gilet — Marstrand (navy)", label: "Gilet — Marstrand (navy)" },
  { value: "Sailor jacket (navy)", label: "Sailor jacket (navy)" },
  { value: "Collared shirt (white)", label: "Collared shirt (white)" },
  { value: "Premier white shirt", label: "Premier white shirt" },
  { value: "Backpack", label: "Backpack" },
  { value: "High Vis", label: "High Vis" },
];

const MERCH_FITS: FieldOption[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "", label: "—" },
];

const MERCH_COLOURS: FieldOption[] = [
  { value: "Navy", label: "Navy" },
  { value: "White", label: "White" },
  { value: "Yellow", label: "Yellow" },
];

const MERCH_LOGOS: FieldOption[] = [
  { value: "Commercial", label: "Commercial" },
  { value: "Yacht Transport", label: "Yacht Transport" },
  { value: "Forwarding", label: "Forwarding" },
  { value: "Other", label: "Other" },
];

const MERCH_BRANDS: FieldOption[] = [
  { value: "North Sails", label: "North Sails" },
  { value: "Henbury", label: "Henbury" },
  { value: "Premier", label: "Premier" },
  { value: "BagBase", label: "BagBase" },
  { value: "Other", label: "Other" },
];

const INVENTORY_SIZES: FieldOption[] = [
  ...MERCH_SIZES,
  { value: "S-M", label: "S-M" },
  { value: "N/A", label: "N/A" },
];

const STAFF_KINDS: FieldOption[] = [
  { value: "asset", label: "Asset request" },
  { value: "social_form", label: "Social media form" },
  { value: "other", label: "Other" },
];

const PARTNER_KINDS: FieldOption[] = [
  { value: "sponsorship", label: "Sponsorship" },
  { value: "membership", label: "Membership" },
];

const DIVISIONS: FieldOption[] = [
  { value: "All", label: "All" },
  { value: "Racing", label: "Racing" },
  { value: "Commercial", label: "Commercial" },
  { value: "Leisure", label: "Leisure" },
  { value: "Forwarding", label: "Forwarding" },
  { value: "CMT", label: "CMT" },
];

const f = (
  key: string,
  opts: {
    label?: string;
    type?: FieldType;
    options?: FieldOption[];
    optionsSource?: FieldOptionsSource;
    locked?: boolean;
  } = {}
): FieldDef => ({
  key,
  label: opts.label ?? key.replace(/_/g, " "),
  type: opts.type ?? "text",
  options: opts.options,
  optionsSource: opts.optionsSource,
  locked: opts.locked,
});

/** Owner fields: select populated from the contacts table (stores contact name). */
const ownerField = (): FieldDef =>
  f("owner", { type: "select", optionsSource: "contacts" });

/** Editable store collections (raw table view). */
export const DATA_COLLECTIONS: CollectionDef[] = [
  {
    key: "events",
    label: "Events",
    description: "Shows, meetings, ceremonies",
    fields: [
      f("id", { type: "readonly", locked: true }),
      f("title"),
      f("starts_at", { type: "datetime", label: "Starts" }),
      f("ends_at", { type: "datetime", label: "Ends" }),
      f("location"),
      f("event_type", {
        type: "select",
        label: "Type",
        options: EVENT_TYPES,
      }),
      f("division", { type: "select", options: DIVISIONS }),
      f("notes", { type: "longtext" }),
      f("link_url", { type: "url", label: "Link" }),
      f("created_by", { label: "Created by" }),
      f("created_at", { type: "readonly", locked: true }),
      f("updated_at", { type: "readonly", locked: true }),
    ],
  },
  {
    key: "content",
    label: "Content / Social Posts",
    description: "Pipeline pieces",
    fields: [
      f("id", { type: "readonly", locked: true }),
      f("title"),
      f("content_type", {
        type: "select",
        label: "Content type",
        options: CONTENT_TYPES,
      }),
      f("channel", { type: "select", options: CHANNELS }),
      f("due_date", { type: "date", label: "Due date" }),
      f("status", { type: "select", options: CONTENT_STATUS }),
      f("planable_url", { type: "url", label: "Planable URL" }),
      f("asset_url", { type: "url", label: "Asset URL" }),
      f("notes", { type: "longtext" }),
      f("created_at", { type: "readonly", locked: true }),
      f("updated_at", { type: "readonly", locked: true }),
    ],
  },
  {
    key: "sponsorships",
    label: "Partners",
    description: "Sponsorships & memberships",
    fields: [
      f("id", { type: "readonly", locked: true }),
      f("kind", { type: "select", options: PARTNER_KINDS }),
      f("partner", { label: "Partner / organisation" }),
      f("package_name", { label: "Package / tier" }),
      f("starts_at", { type: "date", label: "Starts" }),
      f("ends_at", { type: "date", label: "Ends" }),
      f("value"),
      f("status", { type: "select", options: PARTNER_STATUS }),
      f("deliverables", { type: "longtext" }),
      ownerField(),
      f("onedrive_url", { type: "url", label: "Docs URL" }),
      f("notes", { type: "longtext" }),
      f("created_at", { type: "readonly", locked: true }),
      f("updated_at", { type: "readonly", locked: true }),
    ],
  },
  {
    key: "awards",
    label: "Awards",
    description: "Industry awards tracking",
    fields: [
      f("id", { type: "readonly", locked: true }),
      f("title"),
      f("organisation"),
      f("category"),
      f("year", { type: "number" }),
      f("status", { type: "select", options: AWARD_STATUS }),
      f("ceremony_at", { type: "date", label: "Ceremony" }),
      ownerField(),
      f("event_id", { label: "Event id" }),
      f("notes", { type: "longtext" }),
      f("created_at", { type: "readonly", locked: true }),
      f("updated_at", { type: "readonly", locked: true }),
    ],
  },
  {
    key: "contacts",
    label: "Contacts",
    description: "Press, partners, venues",
    fields: [
      f("id", { type: "readonly", locked: true }),
      f("name"),
      f("organisation"),
      f("role"),
      f("email", { type: "email" }),
      f("phone"),
      f("tags", { type: "tags" }),
      f("notes", { type: "longtext" }),
      f("user_id", { label: "Linked user ID", type: "readonly" }),
      f("created_at", { type: "readonly", locked: true }),
      f("updated_at", { type: "readonly", locked: true }),
    ],
  },
  {
    key: "resources",
    label: "Resources",
    description: "Useful links",
    fields: [
      f("id", { type: "readonly", locked: true }),
      f("title"),
      f("description", { type: "longtext" }),
      f("url", { type: "url" }),
      f("category", { type: "select", options: RESOURCE_CATEGORIES }),
      f("created_at", { type: "readonly", locked: true }),
      f("updated_at", { type: "readonly", locked: true }),
    ],
  },
  {
    key: "reports",
    label: "Reports",
    description: "Analytics links",
    fields: [
      f("id", { type: "readonly", locked: true }),
      f("title"),
      f("description", { type: "longtext" }),
      f("url", { type: "url" }),
      f("category", { type: "select", options: REPORT_CATEGORIES }),
      f("tool", { type: "select", options: REPORT_TOOLS }),
      f("created_at", { type: "readonly", locked: true }),
      f("updated_at", { type: "readonly", locked: true }),
    ],
  },
  {
    key: "themes",
    label: "Themes",
    description: "Quarterly themes",
    fields: [
      f("id", { type: "readonly", locked: true }),
      f("title"),
      f("quarter", { type: "select", options: QUARTERS }),
      f("year", { type: "number" }),
      f("status", { type: "select", options: THEME_STATUS }),
      f("summary", { type: "longtext" }),
      f("created_at", { type: "readonly", locked: true }),
      f("updated_at", { type: "readonly", locked: true }),
    ],
  },
  {
    key: "theme_mains",
    label: "Theme mains",
    description: "Main content under themes",
    fields: [
      f("id", { type: "readonly", locked: true }),
      f("theme_id", { label: "Theme id" }),
      f("content_id", { label: "Content id" }),
      f("title"),
      f("channel", { type: "select", options: CHANNELS }),
      ownerField(),
      f("status", { type: "select", options: CONTENT_STATUS }),
      f("notes", { type: "longtext" }),
      f("created_at", { type: "readonly", locked: true }),
      f("updated_at", { type: "readonly", locked: true }),
    ],
  },
  {
    key: "theme_offshoots",
    label: "Theme offshoots",
    description: "Offshoot content",
    fields: [
      f("id", { type: "readonly", locked: true }),
      f("main_content_id", { label: "Main id" }),
      f("title"),
      f("channel", { type: "select", options: CHANNELS }),
      ownerField(),
      f("status", { type: "select", options: CONTENT_STATUS }),
      f("notes", { type: "longtext" }),
      f("created_at", { type: "readonly", locked: true }),
      f("updated_at", { type: "readonly", locked: true }),
    ],
  },
  {
    key: "merch_orders",
    label: "Merch orders",
    description: "North Sails corporate clothing",
    fields: [
      f("id", { type: "readonly", locked: true }),
      f("item", { type: "select", options: MERCH_ITEMS }),
      f("fit", { type: "select", options: MERCH_FITS, label: "Fit" }),
      f("size", { type: "select", options: MERCH_SIZES }),
      f("quantity", { type: "number" }),
      f("colour", { type: "select", options: MERCH_COLOURS }),
      f("logo", { type: "select", options: MERCH_LOGOS, label: "Logo" }),
      f("requested_for", { label: "Requested for" }),
      f("office"),
      f("needed_by", { type: "date", label: "Needed by" }),
      f("status", { type: "select", options: MERCH_STATUS }),
      f("notes", { type: "longtext" }),
      f("created_by", { label: "Created by" }),
      f("created_by_user_id", {
        label: "Created by user ID",
        type: "readonly",
        locked: true,
      }),
      f("created_at", { type: "readonly", locked: true }),
      f("updated_at", { type: "readonly", locked: true }),
    ],
  },
  {
    key: "merch_inventory",
    label: "Merch inventory",
    description: "On-hand corporate clothing stock",
    fields: [
      f("id", { type: "readonly", locked: true }),
      f("item", { type: "select", options: MERCH_ITEMS }),
      f("brand", { type: "select", options: MERCH_BRANDS }),
      f("fit", { type: "select", options: MERCH_FITS, label: "Fit" }),
      f("size", { type: "select", options: INVENTORY_SIZES }),
      f("colour", { type: "select", options: MERCH_COLOURS }),
      f("quantity", { type: "number" }),
      f("notes", { type: "longtext" }),
      f("created_at", { type: "readonly", locked: true }),
      f("updated_at", { type: "readonly", locked: true }),
    ],
  },
  {
    key: "staff_requests",
    label: "Staff requests",
    description: "Asset & form requests",
    fields: [
      f("id", { type: "readonly", locked: true }),
      f("kind", { type: "select", options: STAFF_KINDS }),
      f("title"),
      f("details", { type: "longtext" }),
      f("requested_by", { label: "Requested by" }),
      f("needed_by", { type: "date", label: "Needed by" }),
      f("status", { type: "select", options: STAFF_REQUEST_STATUS }),
      f("created_at", { type: "readonly", locked: true }),
      f("updated_at", { type: "readonly", locked: true }),
    ],
  },
  {
    key: "tasks",
    label: "Tasks",
    description: "Marketing to-dos",
    fields: [
      f("id", { type: "readonly", locked: true }),
      f("title"),
      f("details", { type: "longtext" }),
      f("due_date", { type: "date", label: "Due date" }),
      f("category", { type: "select", options: TASK_CATEGORIES }),
      f("status", {
        type: "select",
        options: [
          { value: "todo", label: "To do" },
          { value: "doing", label: "Doing" },
          { value: "done", label: "Done" },
        ],
      }),
      ownerField(),
      f("created_at", { type: "readonly", locked: true }),
      f("updated_at", { type: "readonly", locked: true }),
    ],
  },
];

export function getCollection(key: string): CollectionDef | undefined {
  return DATA_COLLECTIONS.find((c) => c.key === key);
}

export function isCollectionKey(key: string): key is CollectionKey {
  return DATA_COLLECTIONS.some((c) => c.key === key);
}

/** Keep a legacy/custom value selectable when it is not in the option list. */
export function selectOptionsWithCurrent(
  options: FieldOption[],
  currentValue?: string
): FieldOption[] {
  const current = (currentValue ?? "").trim();
  if (!current || options.some((o) => o.value === current)) return options;
  return [{ value: current, label: `${current} (custom)` }, ...options];
}

/** Build owner dropdown options from the contacts table. */
export function contactOwnerOptions(
  contacts: { name: string; organisation?: string }[],
  currentValue?: string
): FieldOption[] {
  const seen = new Set<string>();
  const options: FieldOption[] = [];
  for (const c of contacts) {
    const name = (c.name ?? "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const org = (c.organisation ?? "").trim();
    options.push({
      value: name,
      label: org ? `${name} · ${org}` : name,
    });
  }
  options.sort((a, b) => a.label.localeCompare(b.label));
  const current = (currentValue ?? "").trim();
  if (current && !seen.has(current)) {
    options.unshift({
      value: current,
      label: `${current} (not in contacts)`,
    });
  }
  return options;
}

/** Infer type for custom / discovered fields. */
export function inferFieldType(key: string): FieldType {
  const k = key.toLowerCase();
  if (k === "id" || k === "created_at" || k === "updated_at") return "readonly";
  if (k === "owner") return "select";
  if (k.includes("email")) return "email";
  if (k.includes("url") || k.includes("link")) return "url";
  if (k === "tags") return "tags";
  if (
    k.includes("notes") ||
    k.includes("details") ||
    k.includes("summary") ||
    k.includes("description") ||
    k.includes("deliverables")
  ) {
    return "longtext";
  }
  if (k === "starts_at" || k === "ends_at") return "datetime";
  if (
    k.endsWith("_at") ||
    k.endsWith("_date") ||
    k.includes("needed_by") ||
    k.includes("ceremony") ||
    k.includes("due_date")
  ) {
    return "date";
  }
  if (k.includes("quantity") || k === "year") return "number";
  return "text";
}

export function statusTone(value: string): string {
  const s = value.toLowerCase();
  if (
    s.includes("publish") ||
    s.includes("active") ||
    s.includes("won") ||
    s.includes("delivered") ||
    s.includes("done") ||
    (s.includes("going") && !s.includes("not"))
  ) {
    return "bg-emerald-50 text-emerald-800 border-emerald-200";
  }
  if (
    s.includes("schedul") ||
    s.includes("confirm") ||
    s.includes("submitted") ||
    s.includes("ordered") ||
    s.includes("approved")
  ) {
    return "bg-sky-50 text-sky-800 border-sky-200";
  }
  if (
    s.includes("review") ||
    s.includes("negotiat") ||
    s.includes("shortlist") ||
    s.includes("entering") ||
    s.includes("maybe") ||
    s.includes("progress")
  ) {
    return "bg-amber-50 text-amber-900 border-amber-200";
  }
  if (
    s.includes("declin") ||
    s.includes("cancel") ||
    s.includes("not_won") ||
    s.includes("not_going")
  ) {
    return "bg-rose-50 text-rose-800 border-rose-200";
  }
  if (s.includes("complete") || s.includes("previous")) {
    return "bg-slate-100 text-slate-700 border-slate-200";
  }
  return "bg-sand text-foreground border-border";
}
