/**
 * One-shot: push .data/store.json into Supabase hub tables.
 * Usage: node scripts/push-store-to-supabase.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  const path = resolve(root, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const storePath = resolve(root, ".data/store.json");
const store = JSON.parse(readFileSync(storePath, "utf8"));
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BATCH = 200;

function dateOnly(value) {
  if (!value) return null;
  const s = String(value).trim();
  return s ? s.slice(0, 10) : null;
}

async function upsert(table, rows) {
  if (!rows.length) {
    console.log(`  ${table}: 0`);
    return 0;
  }
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await client.from(table).upsert(chunk, { onConflict: "id" });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`  ${table}: ${rows.length}`);
  return rows.length;
}

const counts = {};

counts.events = await upsert(
  "events",
  (store.events || []).map((e) => ({
    id: e.id,
    title: e.title,
    starts_at: e.starts_at,
    ends_at: e.ends_at,
    location: e.location ?? "",
    event_type: e.event_type ?? "Event",
    division: e.division ?? "",
    notes: e.notes ?? "",
    link_url: e.link_url ?? "",
    created_by: e.created_by,
    created_at: e.created_at,
    updated_at: e.updated_at,
  }))
);

counts.content_items = await upsert(
  "content_items",
  (store.content || []).map((c) => ({
    id: c.id,
    title: c.title,
    channel: c.channel ?? "",
    content_type: c.content_type ?? "Social",
    owner: c.owner ?? "",
    due_date: dateOnly(c.due_date),
    status: c.status,
    planable_url: c.planable_url ?? "",
    asset_url: c.asset_url ?? "",
    notes: c.notes ?? "",
    created_at: c.created_at,
    updated_at: c.updated_at,
  }))
);

counts.sponsorships = await upsert(
  "sponsorships",
  (store.sponsorships || []).map((s) => ({
    id: s.id,
    kind: s.kind ?? "sponsorship",
    partner: s.partner,
    package_name: s.package_name ?? "",
    starts_at: dateOnly(s.starts_at),
    ends_at: dateOnly(s.ends_at),
    value: s.value ?? "",
    status: s.status,
    deliverables: s.deliverables ?? "",
    owner: s.owner ?? "",
    onedrive_url: s.onedrive_url ?? "",
    notes: s.notes ?? "",
    created_at: s.created_at,
    updated_at: s.updated_at,
  }))
);

counts.contacts = await upsert(
  "contacts",
  (store.contacts || []).map((c) => ({
    id: c.id,
    name: c.name,
    organisation: c.organisation ?? "",
    role: c.role ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    tags: c.tags ?? [],
    notes: c.notes ?? "",
    created_at: c.created_at,
    updated_at: c.updated_at,
  }))
);

counts.resource_links = await upsert(
  "resource_links",
  (store.resources || []).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description ?? "",
    url: r.url,
    category: r.category ?? "General",
    created_at: r.created_at,
    updated_at: r.updated_at,
  }))
);

counts.quarterly_themes = await upsert(
  "quarterly_themes",
  (store.themes || []).map((t) => ({
    id: t.id,
    title: t.title,
    quarter: t.quarter,
    year: t.year,
    status: t.status,
    summary: t.summary ?? "",
    created_at: t.created_at,
    updated_at: t.updated_at,
  }))
);

counts.theme_main_content = await upsert(
  "theme_main_content",
  (store.theme_mains || []).map((m) => ({
    id: m.id,
    theme_id: m.theme_id,
    content_id: m.content_id ?? null,
    title: m.title,
    channel: m.channel ?? "",
    owner: m.owner ?? "",
    status: m.status,
    notes: m.notes ?? "",
    created_at: m.created_at,
    updated_at: m.updated_at,
  }))
);

counts.theme_offshoots = await upsert(
  "theme_offshoots",
  (store.theme_offshoots || []).map((o) => ({
    id: o.id,
    main_content_id: o.main_content_id,
    title: o.title,
    channel: o.channel ?? "",
    owner: o.owner ?? "",
    status: o.status,
    notes: o.notes ?? "",
    created_at: o.created_at,
    updated_at: o.updated_at,
  }))
);

counts.award_entries = await upsert(
  "award_entries",
  (store.awards || []).map((a) => ({
    id: a.id,
    title: a.title,
    organisation: a.organisation ?? "",
    category: a.category ?? "",
    year: a.year,
    status: a.status,
    ceremony_at: dateOnly(a.ceremony_at),
    owner: a.owner ?? "",
    event_id: a.event_id,
    notes: a.notes ?? "",
    created_at: a.created_at,
    updated_at: a.updated_at,
  }))
);

counts.hub_tasks = await upsert(
  "hub_tasks",
  (store.tasks || []).map((t) => ({
    id: t.id,
    title: t.title,
    details: t.details ?? "",
    due_date: dateOnly(t.due_date),
    category: t.category ?? "",
    status: t.status,
    owner: t.owner ?? "",
    created_at: t.created_at,
    updated_at: t.updated_at,
  }))
);

counts.merch_orders = await upsert(
  "merch_orders",
  (store.merch_orders || []).map((m) => ({
    id: m.id,
    item: m.item,
    fit: m.fit === "male" || m.fit === "female" ? m.fit : "",
    size: m.size ?? "",
    quantity: m.quantity ?? 1,
    colour: m.colour ?? "",
    logo: m.logo ?? "Commercial",
    requested_for: m.requested_for ?? "",
    office: m.office ?? "",
    needed_by: dateOnly(m.needed_by),
    status: m.status,
    notes: m.notes ?? "",
    created_by: m.created_by ?? "",
    created_at: m.created_at,
    updated_at: m.updated_at,
  }))
);

counts.staff_requests = await upsert(
  "staff_requests",
  (store.staff_requests || []).map((s) => ({
    id: s.id,
    kind: s.kind,
    category: s.category ?? "",
    title: s.title,
    details: s.details ?? "",
    requested_by: s.requested_by ?? "",
    needed_by: dateOnly(s.needed_by),
    attachment_url: s.attachment_url ?? "",
    status: s.status,
    created_at: s.created_at,
    updated_at: s.updated_at,
  }))
);

counts.report_links = await upsert(
  "report_links",
  (store.reports || []).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description ?? "",
    url: r.url ?? "",
    category: r.category ?? "",
    tool: r.tool ?? "",
    created_at: r.created_at,
    updated_at: r.updated_at,
  }))
);

// Also upsert the durable JSON store the app actually reads at runtime.
{
  const { error } = await client.from("hub_store").upsert(
    {
      id: "default",
      payload: store,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(`hub_store: ${error.message}`);
  counts.hub_store_contacts = (store.contacts || []).length;
  console.log(`  hub_store: contacts=${counts.hub_store_contacts}`);
}

console.log("\nDone:", counts);
