import fs from "fs";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path) {
  const out = {};
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (inQuotes) {
      if (c === '"' && n === '"') {
        field += '"';
        i++;
        continue;
      }
      if (c === '"') {
        inQuotes = false;
        continue;
      }
      field += c;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && n === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
      continue;
    }
    field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.some((x) => x !== "")) rows.push(row);
  }
  return rows;
}

function yes(v) {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  return s === "yes" || s === "true" || s === "1";
}

const env = loadEnv(".env.local");
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase env");

const csvPath =
  process.argv[2] ||
  "C:/Users/Sophie.Edgerley/Downloads/web_enquiries_2026-07-21.csv";
const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
const header = rows[0];
const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
if (idx.submission_id == null) throw new Error("Missing submission_id column");

const supabase = createClient(url, key, {
  auth: { persistSession: false },
});
const now = new Date().toISOString();
const batch = [];

for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  const get = (k) => (r[idx[k]] ?? "").trim();
  const submission_id = get("submission_id");
  if (!submission_id) continue;
  const createdRaw = get("created_at");
  let created_at = null;
  if (createdRaw) {
    const d = new Date(createdRaw);
    if (!Number.isNaN(d.getTime())) created_at = d.toISOString();
  }
  const flat = Object.fromEntries(header.map((h) => [h, get(h)]));
  batch.push({
    id: "enq_" + crypto.randomUUID().slice(0, 8),
    submission_id,
    created_at,
    customer_name: get("customer_name"),
    customer_email: get("customer_email"),
    customer_phone: get("customer_phone"),
    customer_country: get("customer_country"),
    final_service_category: get("final_service_category"),
    user_selected_service: get("user_selected_service"),
    collection_location: get("collection_location"),
    delivery_location: get("delivery_location"),
    selected_office: get("selected_office"),
    office_email: get("office_email"),
    routing_reason: get("routing_reason"),
    needs_manual_review: yes(get("needs_manual_review")),
    marketing_emails_consent: yes(get("marketing_emails_consent")),
    is_test: yes(get("is_test")),
    status: "new",
    make_fields: {},
    raw_payload: { import_source: "csv", ...flat },
    received_at: created_at || now,
    updated_at: now,
  });
}

console.log("Parsed", batch.length, "rows");

const { data: existing, error: e1 } = await supabase
  .from("web_enquiries")
  .select("id, submission_id, status");
if (e1) throw e1;
const bySub = new Map((existing || []).map((x) => [x.submission_id, x]));
for (const row of batch) {
  const prev = bySub.get(row.submission_id);
  if (prev) {
    row.id = prev.id;
    row.status = prev.status;
  }
}

let ok = 0;
let fail = 0;
const size = 100;
for (let i = 0; i < batch.length; i += size) {
  const chunk = batch.slice(i, i + size);
  const { error } = await supabase
    .from("web_enquiries")
    .upsert(chunk, { onConflict: "submission_id" });
  if (error) {
    console.error("Chunk failed at", i, error.message);
    fail += chunk.length;
  } else {
    ok += chunk.length;
    console.log(`Upserted ${ok}/${batch.length}`);
  }
}

const { count } = await supabase
  .from("web_enquiries")
  .select("*", { count: "exact", head: true });
console.log("Done ok=" + ok + " fail=" + fail + " table_count=" + count);
