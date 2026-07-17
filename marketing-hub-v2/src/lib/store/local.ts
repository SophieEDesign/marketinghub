import { promises as fs } from "fs";
import path from "path";
import type { ContentItem, EventItem, HubStore, MerchOrder } from "@/lib/types";
import { createSeedStore } from "@/lib/store/seed";
import { getDataDir } from "@/lib/store/paths";
import { normalizeContentType } from "@/lib/data/normalize";

const DATA_DIR = getDataDir();
const STORE_PATH = path.join(DATA_DIR, "store.json");

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
  }));
}

function withDefaults(store: Partial<HubStore>): HubStore {
  const seed = createSeedStore();
  return {
    events: migrateEvents(store.events) ?? seed.events,
    content: migrateContent(store.content) ?? seed.content,
    sponsorships: store.sponsorships ?? seed.sponsorships,
    contacts: store.contacts ?? seed.contacts,
    resources: store.resources ?? seed.resources,
    reports: store.reports ?? seed.reports,
    themes: store.themes ?? seed.themes,
    theme_mains: store.theme_mains ?? seed.theme_mains,
    theme_offshoots: store.theme_offshoots ?? seed.theme_offshoots,
    merch_orders: migrateMerch(store.merch_orders) ?? seed.merch_orders,
    staff_requests: store.staff_requests ?? seed.staff_requests,
    awards: store.awards ?? seed.awards,
    tasks: store.tasks ?? seed.tasks,
  };
}

async function ensureStore(): Promise<HubStore> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<HubStore>;
    const merged = withDefaults(parsed);
    // Persist migration if newer collections were missing from an older store
    if (
      !parsed.themes ||
      !parsed.theme_mains ||
      !parsed.theme_offshoots ||
      !parsed.reports ||
      !parsed.merch_orders ||
      !parsed.staff_requests ||
      !parsed.awards ||
      !parsed.tasks
    ) {
      await writeStore(merged);
    }
    return merged;
  } catch {
    const seed = createSeedStore();
    await writeStore(seed);
    return seed;
  }
}

export async function readStore(): Promise<HubStore> {
  return ensureStore();
}

export async function writeStore(store: HubStore): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  } catch (err) {
    // Never crash Server Components if the FS is unavailable
    console.error("[store] write failed", err);
  }
}

export async function updateStore(
  mutator: (store: HubStore) => HubStore | void
): Promise<HubStore> {
  const store = await readStore();
  const next = mutator(store) ?? store;
  await writeStore(next);
  return next;
}
