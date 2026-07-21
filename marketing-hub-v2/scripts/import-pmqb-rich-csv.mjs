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
  return s === "yes" || s === "true" || s === "1" || s === "y";
}

const SKIP_RAW = new Set([
  "id",
  "webhook_status",
  "webhook_response",
  "ga4_status",
  "created_ip",
  "user_agent",
  "User Agent",
]);

const env = loadEnv(".env.local");
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const csvPath =
  process.argv[2] ||
  "C:/Users/Sophie.Edgerley/Downloads/pmqb-submissions-2026-07-21-080113.csv";
const rows = parseCsv(fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, ""));
const header = rows[0];
const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));

const now = new Date().toISOString();
const batch = [];

for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  const get = (...keys) => {
    for (const k of keys) {
      if (idx[k] == null) continue;
      const v = (r[idx[k]] ?? "").trim();
      if (v) return v;
    }
    return "";
  };

  const submission_id = get("submission_id", "Submission ID");
  if (!submission_id) continue;

  const createdRaw = get("created_at", "Created At");
  let created_at = null;
  if (createdRaw) {
    const d = new Date(createdRaw.includes("T") ? createdRaw : createdRaw.replace(" ", "T"));
    if (!Number.isNaN(d.getTime())) created_at = d.toISOString();
  }

  const flat = {};
  for (const h of header) {
    if (SKIP_RAW.has(h)) continue;
    const v = (r[idx[h]] ?? "").trim();
    if (v) flat[h] = v;
  }

  const message =
    get(
      "Message / additional information",
      "Any additional or specific information you feel is important to note?"
    ) || "";

  batch.push({
    id: "enq_" + crypto.randomUUID().slice(0, 8),
    submission_id,
    created_at,
    customer_name: get("customer_name", "Name"),
    customer_email: get("customer_email", "Email"),
    customer_phone: get("customer_phone", "Phone", "Phone Number (please include country code)"),
    customer_country: get("customer_country", "Country"),
    final_service_category: get("service_category", "final_service_category", "Service"),
    user_selected_service: get("user_selected_service"),
    collection_location: get("collection_location", "Transport from"),
    delivery_location: get("delivery_location", "Transport to"),
    selected_office: get("selected_office", "Selected Office"),
    office_email: get("office_email", "Sent to Office"),
    routing_reason: get("routing_reason", "Routing Reason"),
    needs_manual_review: yes(get("needs_manual_review")),
    marketing_emails_consent: yes(get("marketing_emails_consent", "Marketing emails")),
    is_test: false,
    status: "new",
    make_fields: {
      heard_about: get("How did you hear about us?"),
      company: get("Company"),
      message,
    },
    raw_payload: {
      import_source: "pmqb-submissions-csv",
      submission_id,
      created_at: createdRaw,
      message,
      form_fields: flat,
      customer: {
        name: get("customer_name", "Name"),
        email: get("customer_email", "Email"),
        phone: get("customer_phone", "Phone"),
        company: get("Company"),
        country: get("customer_country", "Country"),
      },
      membership: {
        is_member: get("Member"),
        membership_type: get("Membership type"),
        organisation_name: get("Organisation / club"),
      },
      route: {
        collection_location: get("collection_location", "Transport from"),
        delivery_location: get("delivery_location", "Transport to"),
      },
      shipment: {
        yacht_vessel_name: get("Yacht Name"),
        make_model: get("Make & Model"),
        yacht_year_of_build: get("Year of build"),
        length: get("Length"),
        width: get("Width"),
        draft: get("Draft"),
        height: get("Height"),
        weight: get("Weight"),
        approximate_value: get("Value (approx)"),
        own_cradle: get("Own cradle"),
        own_container: get("Own container"),
        cargo_description: get("Cargo Description"),
        hazardous_goods: get("Hazardous goods", "hazardous_goods"),
        goods_in_transit_insurance: get(
          "Goods in Transit insurance",
          "goods_in_transit_insurance"
        ),
        reason_for_shipping: get("Reason for shipping", "reason_for_shipping"),
        vehicle_make_model_year: get("Vehicle"),
        vehicle_driveable: get("Vehicle driveable"),
        general_cargo_context: get("Cargo context (general cargo)"),
      },
      racing: {
        regatta_event: get("Regatta / event name"),
        racing_programme: get("Regatta programme"),
      },
      timing: {
        preferred_departure_date: get("Preferred Date of Departure"),
        preferred_arrival_date: get("Date of arrival"),
        date_flexibility: get("Flexibility"),
        timing_notes: get("Additional timing notes"),
      },
      consent: {
        marketing_emails_consent: get("Marketing emails"),
        advertising_personalisation_consent: get("Advertising personalisation"),
        data_processing_consent: get("Data processing acceptance"),
      },
      tracking: {
        referrer: get("Referrer"),
        current_page_url: get("Page Location"),
        heard_about: get("How did you hear about us?"),
        sailing_schedule_reference: get(
          "Sailing they viewed (from link)",
          "Sailing schedule (from link)"
        ),
        sailing_schedule_vessel_slug: get("Vessel (schedule link slug)", "Carrier vessel (from link)"),
        sailing_departure_region: get(
          "Schedule departure region",
          "Departure region (slug)"
        ),
        sailing_arrival_region: get(
          "Schedule arrival region",
          "Arrival region (slug)"
        ),
      },
    },
    received_at: created_at || now,
    updated_at: now,
  });
}

console.log("Parsed rich rows", batch.length);

const { data: existing, error: e1 } = await supabase
  .from("web_enquiries")
  .select("id, submission_id, status, is_test");
if (e1) throw e1;
const bySub = new Map((existing || []).map((x) => [x.submission_id, x]));

for (const row of batch) {
  const prev = bySub.get(row.submission_id);
  if (prev) {
    row.id = prev.id;
    row.status = prev.status;
    row.is_test = prev.is_test;
  }
}

let ok = 0;
let fail = 0;
const size = 50;
for (let i = 0; i < batch.length; i += size) {
  const chunk = batch.slice(i, i + size);
  const { error } = await supabase
    .from("web_enquiries")
    .upsert(chunk, { onConflict: "submission_id" });
  if (error) {
    console.error("Chunk failed", i, error.message);
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
