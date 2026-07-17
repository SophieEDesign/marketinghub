const fs = require("fs");
const path = require("path");

function extractJson(filePath) {
  let raw = fs.readFileSync(filePath, "utf8");
  // MCP wraps / escapes JSON — normalise
  raw = raw.replace(/\\"/g, '"').replace(/\\n/g, "\n");
  const start = raw.indexOf("[{");
  const end = raw.lastIndexOf("}]");
  if (start < 0 || end < 0) throw new Error("No JSON array in " + filePath);
  return JSON.parse(raw.slice(start, end + 2));
}

function asIso(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function mapStatus(raw) {
  const s = String(raw || "").toLowerCase();
  if (s.includes("publish")) return "published";
  if (s.includes("schedul")) return "scheduled";
  if (s.includes("review") || s.includes("approv")) return "review";
  if (s.includes("draft")) return "draft";
  return "idea";
}

const eventsFile =
  process.argv[2] ||
  "C:/Users/Sophie.Edgerley/.cursor/projects/c-Users-Sophie-Edgerley-OneDrive-Peters-May-Marketing-Website-2025-Marketing-Hub/agent-tools/7777c2d3-225b-4f3e-9aa0-9d96be2bfed1.txt";
const socialFile =
  process.argv[3] ||
  "C:/Users/Sophie.Edgerley/.cursor/projects/c-Users-Sophie-Edgerley-OneDrive-Peters-May-Marketing-Website-2025-Marketing-Hub/agent-tools/770bcc9b-ba91-4b13-b38b-42b8e3d45373.txt";

const eventsRaw = extractJson(eventsFile);
const socialRaw = extractJson(socialFile);
const now = new Date().toISOString();

const events = eventsRaw.map((r) => {
  const location = [r.venue, r.city, r.country].filter(Boolean).join(", ");
  return {
    id: `sb_${r.id}`,
    title: r.event_name || "Untitled event",
    starts_at: asIso(r.start_date) || now,
    ends_at: asIso(r.end_date),
    location,
    event_type: Array.isArray(r.event_type)
      ? r.event_type.join(", ")
      : String(r.event_type || r.status || "Event"),
    notes: r.notes_detail || r.description || "",
    link_url: "",
    created_by: null,
    created_at: asIso(r.created_at) || now,
    updated_at: asIso(r.updated_at) || now,
  };
});

const content = socialRaw.map((r) => ({
  id: `sb_${r.id}`,
  title: r.content_name || "Untitled post",
  channel: r.post_type || "Social",
  owner: r.owner || "",
  due_date: (asIso(r.date_due) || asIso(r.publish_date) || "").slice(0, 10) || null,
  status: mapStatus(r.status || r.planable_status),
  planable_url: r.planable_url || "",
  asset_url: r.canva_url || "",
  notes: r.content_post_text || r.notes_detail || "",
  created_at: asIso(r.created_at) || now,
  updated_at: asIso(r.updated_at) || now,
}));

const storePath = path.join(process.cwd(), ".data", "store.json");
let store = {
  events: [],
  attendance: [],
  content: [],
  sponsorships: [],
  contacts: [],
  resources: [],
  reports: [],
  themes: [],
  theme_mains: [],
  theme_offshoots: [],
};
if (fs.existsSync(storePath)) {
  try {
    store = { ...store, ...JSON.parse(fs.readFileSync(storePath, "utf8")) };
  } catch {
    // keep defaults
  }
}

store.events = events;
store.attendance = [];
store.content = content;

fs.mkdirSync(path.dirname(storePath), { recursive: true });
fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
console.log(
  JSON.stringify(
    { events: events.length, content: content.length, storePath },
    null,
    2
  )
);
