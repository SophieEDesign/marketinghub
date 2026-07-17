import { promises as fs } from "fs";
import path from "path";
import type { ContentItem, EventItem, HubStore, MerchOrder } from "@/lib/types";
import { createSeedStore } from "@/lib/store/seed";
import { getDataDir } from "@/lib/store/paths";
import { normalizeContentType } from "@/lib/data/normalize";
import { allowDemoAuth } from "@/lib/auth/config";
import { hasServiceRoleKey } from "@/lib/supabase/admin";

const DATA_DIR = getDataDir();
const STORE_PATH = path.join(DATA_DIR, "store.json");
const HUB_STORE_ID = "default";

function useDurableSupabaseStore() {
  // Demo/local without service role stays on disk. Production with service role uses DB.
  return hasServiceRoleKey() && !allowDemoAuth();
}

function migrateContent(items: ContentItem[] | undefined): ContentItem[] | undefined {
  if (!items) return items;
  return items.map((item) => ({
    ...item,
    content_type:
      item.content_type?.trim() ||
      normalizeContentType(item.channel || "Social"),
  }));
}

function migrateEvents(items: EventItem[] | undefined): EventItem[] | undefined {
  if (!items) return items;
  return items.map((item) => ({
    ...item,
    division: item.division ?? "",
  }));
}

function migrateMerch(items: MerchOrder[] | undefined): MerchOrder[] | undefined {
  if (!items) return items;
  return items.map((item) => ({
    ...item,
    fit: item.fit === "female" || item.fit === "male" ? item.fit : "",
    created_by_user_id: item.created_by_user_id ?? null,
  }));
}

function migrateContacts(
  items: HubStore["contacts"] | undefined
): HubStore["contacts"] | undefined {
  if (!items) return items;
  return items.map((item) => ({
    ...item,
    user_id: item.user_id ?? null,
  }));
}

function withDefaults(store: Partial<HubStore>): HubStore {
  const seed = createSeedStore();
  return {
    events: migrateEvents(store.events) ?? seed.events,
    content: migrateContent(store.content) ?? seed.content,
    sponsorships: store.sponsorships ?? seed.sponsorships,
    contacts: migrateContacts(store.contacts) ?? seed.contacts,
    resources: store.resources ?? seed.resources,
    reports: store.reports ?? seed.reports,
    themes: store.themes ?? seed.themes,
    theme_mains: store.theme_mains ?? seed.theme_mains,
    theme_offshoots: store.theme_offshoots ?? seed.theme_offshoots,
    merch_orders: migrateMerch(store.merch_orders) ?? seed.merch_orders,
    merch_inventory: store.merch_inventory ?? seed.merch_inventory,
    staff_requests: store.staff_requests ?? seed.staff_requests,
    awards: store.awards ?? seed.awards,
    tasks: store.tasks ?? seed.tasks,
    hub_users: store.hub_users ?? seed.hub_users,
  };
}

async function readLocalFile(): Promise<Partial<HubStore> | null> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return JSON.parse(raw) as Partial<HubStore>;
  } catch {
    return null;
  }
}

async function writeLocalFile(store: HubStore): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  } catch (err) {
    console.error("[store] local write failed", err);
  }
}

async function readRemoteStore(): Promise<Partial<HubStore> | null> {
  try {
    const { createServiceClient } = await import("@/lib/supabase/admin");
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("hub_store")
      .select("payload")
      .eq("id", HUB_STORE_ID)
      .maybeSingle();
    if (error) {
      console.error("[store] remote read failed", error.message);
      return null;
    }
    if (!data?.payload || typeof data.payload !== "object") return null;
    return data.payload as Partial<HubStore>;
  } catch (err) {
    console.error("[store] remote read error", err);
    return null;
  }
}

async function writeRemoteStore(store: HubStore): Promise<boolean> {
  try {
    const { createServiceClient } = await import("@/lib/supabase/admin");
    const supabase = createServiceClient();
    const { error } = await supabase.from("hub_store").upsert(
      {
        id: HUB_STORE_ID,
        payload: store,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (error) {
      console.error("[store] remote write failed", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[store] remote write error", err);
    return false;
  }
}

async function ensureStore(): Promise<HubStore> {
  if (useDurableSupabaseStore()) {
    let parsed = await readRemoteStore();
    if (!parsed) {
      // Bootstrap from local file if present (e.g. after import on one instance).
      parsed = await readLocalFile();
    }
    if (!parsed) {
      const seed = createSeedStore();
      await writeRemoteStore(seed);
      await writeLocalFile(seed);
      return seed;
    }
    const merged = withDefaults(parsed);
    // Persist migrations / first remote write
    await writeRemoteStore(merged);
    await writeLocalFile(merged);
    return merged;
  }

  const parsed = await readLocalFile();
  if (!parsed) {
    const seed = createSeedStore();
    await writeLocalFile(seed);
    return seed;
  }
  const merged = withDefaults(parsed);
  if (
    !parsed.themes ||
    !parsed.theme_mains ||
    !parsed.theme_offshoots ||
    !parsed.reports ||
    !parsed.merch_orders ||
    !parsed.merch_inventory ||
    !parsed.staff_requests ||
    !parsed.awards ||
    !parsed.tasks ||
    !parsed.hub_users
  ) {
    await writeLocalFile(merged);
  }
  return merged;
}

export async function readStore(): Promise<HubStore> {
  return ensureStore();
}

export async function writeStore(store: HubStore): Promise<void> {
  if (useDurableSupabaseStore()) {
    const ok = await writeRemoteStore(store);
    await writeLocalFile(store);
    if (!ok) {
      console.error("[store] durable write failed; local cache updated only");
    }
    return;
  }
  await writeLocalFile(store);
}

export async function updateStore(
  mutator: (store: HubStore) => HubStore | void
): Promise<HubStore> {
  const store = await readStore();
  const next = mutator(store) ?? store;
  await writeStore(next);
  return next;
}
