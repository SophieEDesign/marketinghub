/**
 * Restore .data/store.json into public.hub_store (production durable store).
 * Usage: node scripts/restore-hub-store.mjs
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
if (!existsSync(storePath)) {
  console.error("Missing .data/store.json");
  process.exit(1);
}

const store = JSON.parse(readFileSync(storePath, "utf8"));
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const summary = {
  contacts: (store.contacts || []).length,
  events: (store.events || []).length,
  content: (store.content || []).length,
  tasks: (store.tasks || []).length,
  partners: (store.partners || []).length,
  awards: (store.awards || []).length,
};
console.log("Restoring hub_store from local store.json:", summary);

const { error } = await client.from("hub_store").upsert(
  {
    id: "default",
    payload: store,
    updated_at: new Date().toISOString(),
  },
  { onConflict: "id" }
);

if (error) {
  console.error("Restore failed:", error.message);
  process.exit(1);
}

const { data, error: readError } = await client
  .from("hub_store")
  .select("updated_at, payload")
  .eq("id", "default")
  .maybeSingle();

if (readError) {
  console.error("Verify failed:", readError.message);
  process.exit(1);
}

const payload = data?.payload || {};
console.log("hub_store restored OK:", {
  updated_at: data?.updated_at,
  contacts: (payload.contacts || []).length,
  events: (payload.events || []).length,
  content: (payload.content || []).length,
  tasks: (payload.tasks || []).length,
});
