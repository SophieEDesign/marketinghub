/**
 * One-off / reusable cleanup of .data/store.json for the new hub shape.
 * Run: node scripts/clean-store.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const storePath = join(__dirname, "..", ".data", "store.json");

const PLATFORM_HINTS = [
  { re: /\blinkedin\b|\bli\b|#linkedin/i, channel: "LinkedIn" },
  { re: /\binstagram\b|\big\b|#instagram|\breel\b/i, channel: "Instagram" },
  { re: /\bfacebook\b|\bfb\b|#facebook/i, channel: "Facebook" },
  { re: /\btiktok\b|#tiktok/i, channel: "TikTok" },
  { re: /\byoutube\b|\byt\b|#youtube/i, channel: "YouTube" },
  { re: /\bnewsletter\b/i, channel: "Newsletter" },
  { re: /\bpress\b|\bpr\b|\brelease\b/i, channel: "PR" },
  { re: /\btwitter\b|\btweet\b|#twitter/i, channel: "X" },
];

const GENERIC_SOCIAL = /^(social(\s*post|\s*media)?|social_post|post)$/i;

const EVENT_TYPE_MAP = {
  event: "Trade show",
  events: "Trade show",
  commercial_event: "Commercial",
  commercial: "Commercial",
  awards: "Awards",
  award: "Awards",
  sponsorship_event: "Sponsorship",
  sponsorship: "Sponsorship",
  conference: "Conference",
  meeting: "Meeting",
  internal: "Internal",
};

function stripHtml(input) {
  if (!input) return "";
  return String(input)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractAssetUrl(raw) {
  const s = (raw ?? "").trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("{")) {
    try {
      const parsed = JSON.parse(s);
      if (parsed?.url && typeof parsed.url === "string") return parsed.url;
    } catch {
      /* ignore */
    }
  }
  return s.length < 500 ? s : "";
}

function detectPlatform(...parts) {
  const hay = parts.filter(Boolean).join(" ");
  for (const hint of PLATFORM_HINTS) {
    if (hint.re.test(hay)) return hint.channel;
  }
  return null;
}

function normalizeChannel(raw, title = "", notes = "") {
  const s = (raw ?? "").trim();
  if (!s || GENERIC_SOCIAL.test(s)) {
    return detectPlatform(title, notes, s) || "LinkedIn";
  }
  const lower = s.toLowerCase();
  if (lower === "editorial") return "Editorial";
  if (lower === "newsletter") return "Newsletter";
  if (lower === "sponsorship") return "Sponsorship";
  if (lower === "content") return "Article";
  if (lower === "pr" || lower === "press") return "PR";
  const fromRaw = detectPlatform(s);
  if (fromRaw) return fromRaw;
  if (/^[a-z0-9_]+$/i.test(s)) {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }
  return s;
}

function normalizeEventType(raw) {
  const s = (raw ?? "").trim();
  if (!s) return "Event";
  const key = s.toLowerCase().replace(/\s+/g, "_");
  if (EVENT_TYPE_MAP[key]) return EVENT_TYPE_MAP[key];
  if (s.includes("_")) {
    return s
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const store = JSON.parse(readFileSync(storePath, "utf8"));

let contentChanged = 0;
store.content = (store.content || []).map((c) => {
  const notes = stripHtml(c.notes);
  const title = stripHtml(c.title) || "Untitled post";
  const channel = normalizeChannel(c.channel, title, notes);
  const asset_url = extractAssetUrl(c.asset_url);
  const next = {
    ...c,
    title,
    channel,
    owner: (c.owner ?? "").trim(),
    notes,
    asset_url,
    planable_url: (c.planable_url ?? "").trim(),
  };
  if (
    next.title !== c.title ||
    next.channel !== c.channel ||
    next.notes !== c.notes ||
    next.asset_url !== c.asset_url
  ) {
    contentChanged++;
  }
  return next;
});

// Prefer newer first for planner browsing
store.content.sort((a, b) =>
  String(b.updated_at || b.created_at || "").localeCompare(
    String(a.updated_at || a.created_at || "")
  )
);

let eventsChanged = 0;
store.events = (store.events || []).map((e) => {
  const title = stripHtml(e.title) || "Untitled event";
  const event_type = normalizeEventType(e.event_type);
  const notes = stripHtml(e.notes);
  const location = stripHtml(e.location);
  const next = {
    ...e,
    title,
    event_type,
    notes,
    location,
    link_url: (e.link_url ?? "").trim(),
  };
  if (
    next.title !== e.title ||
    next.event_type !== e.event_type ||
    next.notes !== e.notes
  ) {
    eventsChanged++;
  }
  return next;
});

store.events.sort(
  (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
);

function normKeyPart(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const STATUS_RANK = {
  published: 5,
  scheduled: 4,
  review: 3,
  draft: 2,
  idea: 1,
};

function contentScore(item) {
  const status = STATUS_RANK[item.status] ?? 0;
  const richness =
    (item.notes ? 2 : 0) +
    (item.asset_url ? 1 : 0) +
    (item.planable_url ? 1 : 0) +
    (item.owner ? 1 : 0);
  const updated = Date.parse(item.updated_at) || 0;
  return status * 1_000_000 + richness * 10_000 + updated / 1_000_000;
}

const beforeContent = store.content.length;
const contentBest = new Map();
for (const item of store.content) {
  const key = [
    normKeyPart(item.title),
    item.due_date ?? "",
    normKeyPart(item.channel),
  ].join("|");
  const prev = contentBest.get(key);
  if (!prev || contentScore(item) > contentScore(prev)) {
    contentBest.set(key, item);
  }
}
store.content = Array.from(contentBest.values());
store.content.sort((a, b) =>
  String(b.updated_at || b.created_at || "").localeCompare(
    String(a.updated_at || a.created_at || "")
  )
);
const contentRemoved = beforeContent - store.content.length;

const beforeEvents = store.events.length;
const eventBest = new Map();
for (const item of store.events) {
  const key = [
    normKeyPart(item.title),
    String(item.starts_at ?? "").slice(0, 10),
  ].join("|");
  const prev = eventBest.get(key);
  if (!prev) {
    eventBest.set(key, item);
    continue;
  }
  const score = (x) =>
    (x.notes ? 2 : 0) +
    (x.location ? 1 : 0) +
    (Date.parse(x.updated_at) || 0) / 1_000_000;
  if (score(item) > score(prev)) eventBest.set(key, item);
}
store.events = Array.from(eventBest.values());
store.events.sort(
  (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
);
const eventsRemoved = beforeEvents - store.events.length;

store.sponsorships = (store.sponsorships || []).map((s) => ({
  ...s,
  notes: stripHtml(s.notes),
  deliverables: stripHtml(s.deliverables),
  partner: stripHtml(s.partner) || s.partner,
}));

// Library-friendly resource links if still placeholders
const hasRealResources = (store.resources || []).some(
  (r) => r.url && !/onedrive\.live\.com\/?$/i.test(r.url)
);
if (!hasRealResources) {
  const now = new Date().toISOString();
  store.resources = [
    {
      id: "res_hub_brand",
      title: "Brand guidelines (PDF)",
      description: "Full brand guide — also in Library → Brand",
      url: "https://hwtycgvclhckglmuwnmw.supabase.co/storage/v1/object/public/attachments/attachments/table_media_1768074185692/19e724de-39c2-4ee5-b545-dae584996d8c/media/4363f3e1-1bb0-49f4-ad10-7f6d92ea52e0.pdf",
      category: "Brand",
      created_at: now,
      updated_at: now,
    },
    {
      id: "res_hub_press",
      title: "Press & media enquiries",
      description: "Route press requests to marketing",
      url: "mailto:marketing@petersandmay.com",
      category: "Press",
      created_at: now,
      updated_at: now,
    },
    {
      id: "res_hub_careers",
      title: "Careers page",
      description: "Live roles for social hiring posts",
      url: "https://www.petersandmay.com/about-us/careers/",
      category: "Web",
      created_at: now,
      updated_at: now,
    },
  ];
}

writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8");

const channels = {};
for (const c of store.content) {
  channels[c.channel] = (channels[c.channel] || 0) + 1;
}
const types = {};
for (const e of store.events) {
  types[e.event_type] = (types[e.event_type] || 0) + 1;
}

console.log(
  JSON.stringify(
    {
      contentCleaned: contentChanged,
      contentRemovedDuplicates: contentRemoved,
      contentTotal: store.content.length,
      channels,
      eventsCleaned: eventsChanged,
      eventsRemovedDuplicates: eventsRemoved,
      eventsTotal: store.events.length,
      eventTypes: types,
      resources: store.resources.length,
    },
    null,
    2
  )
);
