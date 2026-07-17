import { promises as fs } from "fs";
import path from "path";
import type { ContentItem, EventItem, HubStore, MerchOrder } from "@/lib/types";
import { createSeedStore } from "@/lib/store/seed";
import { getDataDir } from "@/lib/store/paths";
import {
  normalizeContentType,
  normalizeChannels,
} from "@/lib/data/normalize";
import { allowDemoAuth } from "@/lib/auth/config";
import { hasServiceRoleKey } from "@/lib/supabase/admin";

const DATA_DIR = getDataDir();
const STORE_PATH = path.join(DATA_DIR, "store.json");
const HUB_STORE_ID = "default";

function shouldUseDurableSupabaseStore() {
  // Demo/local without service role stays on disk. Production with service role uses DB.
  return hasServiceRoleKey() && !allowDemoAuth();
}

function migrateContent(items: ContentItem[] | undefined): ContentItem[] | undefined {
  if (!items) return items;
  return items.map((item) => {
    const legacy = item as ContentItem & { channel?: string | string[] };
    const channel = normalizeChannels(legacy.channel);
    return {
      ...item,
      channel,
      content_type:
        item.content_type?.trim() ||
        normalizeContentType(channel[0] || "Social"),
      deadline_date: item.deadline_date ?? null,
      category: item.category ?? "",
      priority: item.priority ?? "",
      website: item.website ?? "",
      caption: item.caption ?? "",
    };
  });
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
    logo: item.logo ?? "Commercial",
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

function migrateThemeMains(
  items: HubStore["theme_mains"] | undefined
): HubStore["theme_mains"] | undefined {
  if (!items) return items;
  return items.map((item) => ({
    ...item,
    content_id: item.content_id ?? null,
  }));
}

function withDefaults(store: Partial<HubStore>): HubStore {
  const seed = createSeedStore();
  // Only fill missing collections with demo rows when the snapshot itself is seed.
  // Real Core snapshots must not get mrc_seed_* orders planted on migration.
  const fillMissingFromSeed = looksLikeSeedStore(store);
  return {
    events: migrateEvents(store.events) ?? seed.events,
    event_attendance: store.event_attendance ?? seed.event_attendance,
    content: migrateContent(store.content) ?? seed.content,
    sponsorships: store.sponsorships ?? seed.sponsorships,
    contacts: migrateContacts(store.contacts) ?? seed.contacts,
    resources: store.resources ?? seed.resources,
    reports: store.reports ?? seed.reports,
    themes: store.themes ?? seed.themes,
    theme_mains: migrateThemeMains(store.theme_mains) ?? seed.theme_mains,
    theme_offshoots: store.theme_offshoots ?? seed.theme_offshoots,
    merch_orders:
      migrateMerch(store.merch_orders) ??
      (fillMissingFromSeed ? seed.merch_orders : []),
    merch_inventory:
      store.merch_inventory ??
      (fillMissingFromSeed ? seed.merch_inventory : []),
    staff_requests: store.staff_requests ?? seed.staff_requests,
    awards: store.awards ?? seed.awards,
    tasks: store.tasks ?? seed.tasks,
    hub_users: store.hub_users ?? seed.hub_users,
    access_requests: store.access_requests ?? seed.access_requests,
  };
}

/** Demo seed rows use ids like `ctc_seed_1` / `evt_seed_2`. Real Core imports use `sb_*`. */
function looksLikeSeedStore(store: Partial<HubStore> | null): boolean {
  if (!store) return false;
  const sample =
    store.contacts?.[0]?.id ??
    store.events?.[0]?.id ??
    store.content?.[0]?.id ??
    store.tasks?.[0]?.id;
  return typeof sample === "string" && sample.includes("_seed_");
}

/**
 * Prefer real Core Data snapshots over demo seed.
 * When both look real, remote is the durable source of truth — never prefer a
 * stale /tmp local copy (that resurrects deleted merch orders, events, etc.).
 */
function pickPreferredStore(
  remote: Partial<HubStore> | null,
  local: Partial<HubStore> | null
): Partial<HubStore> | null {
  if (!remote && !local) return null;
  if (!remote) return local;
  if (!local) return remote;

  const remoteSeed = looksLikeSeedStore(remote);
  const localSeed = looksLikeSeedStore(local);
  if (remoteSeed && !localSeed) return local;
  if (localSeed && !remoteSeed) return remote;

  return remote;
}

function needsKeyMigration(store: Partial<HubStore>): boolean {
  return (
    !store.themes ||
    !store.theme_mains ||
    !store.theme_offshoots ||
    !store.reports ||
    !store.merch_orders ||
    !store.merch_inventory ||
    !store.staff_requests ||
    !store.awards ||
    !store.tasks ||
    !store.hub_users ||
    !store.access_requests
  );
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
  if (shouldUseDurableSupabaseStore()) {
    const remote = await readRemoteStore();
    const local = await readLocalFile();
    const preferred = pickPreferredStore(remote, local);

    if (!preferred) {
      // First-run only: never seed-overwrite an existing remote row.
      const seed = createSeedStore();
      await writeRemoteStore(seed);
      await writeLocalFile(seed);
      return seed;
    }

    const merged = withDefaults(preferred);
    const upgradingFromSeed =
      looksLikeSeedStore(remote) && !looksLikeSeedStore(preferred);
    const remoteMissing = !remote;

    // Do NOT write remote on every read — that races with restores and can
    // push stale /tmp seed back over a good hub_store snapshot.
    if (remoteMissing || upgradingFromSeed || needsKeyMigration(preferred)) {
      await writeRemoteStore(merged);
    }
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
  if (needsKeyMigration(parsed)) {
    await writeLocalFile(merged);
  }
  return merged;
}

export async function readStore(): Promise<HubStore> {
  return ensureStore();
}

export async function writeStore(store: HubStore): Promise<void> {
  if (shouldUseDurableSupabaseStore()) {
    const ok = await writeRemoteStore(store);
    await writeLocalFile(store);
    if (!ok) {
      console.error("[store] durable write failed; local cache updated only");
      throw new Error("Failed to persist hub store to Supabase");
    }
    return;
  }
  await writeLocalFile(store);
}

/** Serialize store mutations on this process so concurrent writes can't clobber each other. */
let updateStoreChain: Promise<unknown> = Promise.resolve();

export async function updateStore(
  mutator: (store: HubStore) => HubStore | void
): Promise<HubStore> {
  const run = async () => {
    const store = await readStore();
    const next = mutator(store) ?? store;
    await writeStore(next);
    return next;
  };
  // Always continue the queue after failures so one bad write doesn't deadlock updates.
  const result = updateStoreChain.then(run, run);
  updateStoreChain = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}
