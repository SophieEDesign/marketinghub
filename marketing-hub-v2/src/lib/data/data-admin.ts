import { promises as fs } from "fs";
import path from "path";
import { uid } from "@/lib/utils";
import { readStore, updateStore } from "@/lib/store/local";
import { getDataDir } from "@/lib/store/paths";
import type { HubStore } from "@/lib/types";
import {
  DATA_COLLECTIONS,
  contactOwnerOptions,
  getCollection,
  inferFieldType,
  isCollectionKey,
  type CollectionKey,
  type FieldDef,
} from "@/lib/data/collections";

const DATA_DIR = getDataDir();
const EXTRAS_PATH = path.join(DATA_DIR, "field-extras.json");

type FieldExtras = Partial<Record<CollectionKey, string[]>>;

async function readExtras(): Promise<FieldExtras> {
  try {
    const raw = await fs.readFile(EXTRAS_PATH, "utf8");
    return JSON.parse(raw) as FieldExtras;
  } catch {
    return {};
  }
}

async function writeExtras(extras: FieldExtras) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(EXTRAS_PATH, JSON.stringify(extras, null, 2), "utf8");
  } catch (err) {
    console.error("[field-extras] write failed", err);
  }
}

function asRows(store: HubStore, key: CollectionKey): Record<string, unknown>[] {
  const value = store[key];
  if (!Array.isArray(value)) return [];
  return value as unknown as Record<string, unknown>[];
}

function discoverKeys(rows: Record<string, unknown>[]): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    Object.keys(row).forEach((k) => keys.add(k));
  }
  return Array.from(keys);
}

function slugField(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export function listCollectionSummaries() {
  return DATA_COLLECTIONS.map((c) => ({
    key: c.key,
    label: c.label,
    description: c.description,
  }));
}

export async function getTable(collection: string) {
  if (!isCollectionKey(collection)) {
    throw new Error("Unknown collection");
  }
  const def = getCollection(collection)!;
  const store = await readStore();
  const rows = asRows(store, collection);
  const extras = await readExtras();
  const extraNames = extras[collection] ?? [];
  const discovered = discoverKeys(rows);

  const fieldMap = new Map<string, FieldDef>();
  for (const field of def.fields) fieldMap.set(field.key, field);
  for (const name of [...extraNames, ...discovered]) {
    if (!fieldMap.has(name)) {
      const type = inferFieldType(name);
      fieldMap.set(name, {
        key: name,
        label: name.replace(/_/g, " "),
        type,
        locked: type === "readonly",
        optionsSource: name.toLowerCase() === "owner" ? "contacts" : undefined,
      });
    }
  }

  // Keep core fields first, then extras alpha
  const coreKeys = def.fields.map((f) => f.key);
  const rest = Array.from(fieldMap.keys())
    .filter((k) => !coreKeys.includes(k))
    .sort((a, b) => a.localeCompare(b));
  const contactOpts = contactOwnerOptions(store.contacts ?? []);
  const fields = [...coreKeys, ...rest]
    .map((k) => fieldMap.get(k)!)
    .filter(Boolean)
    .map((field) =>
      field.optionsSource === "contacts"
        ? { ...field, type: "select" as const, options: contactOpts }
        : field
    );

  return {
    collection,
    label: def.label,
    description: def.description,
    fields,
    rows,
    count: rows.length,
  };
}

export async function updateCell(
  collection: string,
  id: string,
  field: string,
  value: unknown
) {
  if (!isCollectionKey(collection)) throw new Error("Unknown collection");
  if (field === "id") throw new Error("Cannot edit id");

  let updated: Record<string, unknown> | null = null;
  await updateStore((store) => {
    const rows = asRows(store, collection);
    const idx = rows.findIndex((r) => String(r.id) === id);
    if (idx === -1) return;
    const next = { ...rows[idx], [field]: value };
    if ("updated_at" in next) {
      next.updated_at = new Date().toISOString();
    }
    rows[idx] = next;
    (store as HubStore)[collection] = rows as never;
    updated = next;
  });
  if (!updated) throw new Error("Row not found");
  return updated;
}

export async function bulkUpdate(
  collection: string,
  ids: string[],
  field: string,
  value: unknown
) {
  if (!isCollectionKey(collection)) throw new Error("Unknown collection");
  if (field === "id") throw new Error("Cannot edit id");
  if (!ids.length) return { updated: 0 };

  const idSet = new Set(ids.map(String));
  let updated = 0;
  const now = new Date().toISOString();

  await updateStore((store) => {
    const rows = asRows(store, collection).map((row) => {
      if (!idSet.has(String(row.id))) return row;
      updated += 1;
      const next = { ...row, [field]: value };
      if ("updated_at" in next) next.updated_at = now;
      return next;
    });
    (store as HubStore)[collection] = rows as never;
  });

  return { updated };
}

export async function bulkDelete(collection: string, ids: string[]) {
  if (!isCollectionKey(collection)) throw new Error("Unknown collection");
  if (!ids.length) return { deleted: 0 };
  const idSet = new Set(ids.map(String));
  let deleted = 0;
  await updateStore((store) => {
    const before = asRows(store, collection);
    const rows = before.filter((r) => {
      const keep = !idSet.has(String(r.id));
      if (!keep) deleted += 1;
      return keep;
    });
    (store as HubStore)[collection] = rows as never;
  });
  return { deleted };
}

export async function addRow(collection: string, patch: Record<string, unknown> = {}) {
  if (!isCollectionKey(collection)) throw new Error("Unknown collection");
  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    id: uid(collection.slice(0, 3)),
    created_at: now,
    updated_at: now,
    ...patch,
  };

  // Sensible blanks for known fields
  const def = getCollection(collection)!;
  for (const field of def.fields) {
    if (field.key in row) continue;
    if (field.locked) continue;
    row[field.key] = field.key.includes("at") || field.key.includes("date")
      ? null
      : field.key === "tags"
        ? []
        : field.key === "quantity" || field.key === "year"
          ? 0
          : "";
  }

  await updateStore((store) => {
    const rows = asRows(store, collection);
    rows.push(row);
    (store as HubStore)[collection] = rows as never;
  });
  return row;
}

export async function deleteRow(collection: string, id: string) {
  if (!isCollectionKey(collection)) throw new Error("Unknown collection");
  await updateStore((store) => {
    const rows = asRows(store, collection).filter((r) => String(r.id) !== id);
    (store as HubStore)[collection] = rows as never;
  });
}

export async function addField(collection: string, name: string) {
  if (!isCollectionKey(collection)) throw new Error("Unknown collection");
  const key = slugField(name);
  if (!key) throw new Error("Invalid field name");
  if (key === "id") throw new Error("Reserved field");

  const extras = await readExtras();
  const list = new Set(extras[collection] ?? []);
  list.add(key);
  extras[collection] = Array.from(list);
  await writeExtras(extras);

  // Initialise empty value on existing rows so the column is visible
  await updateStore((store) => {
    const rows = asRows(store, collection).map((r) =>
      key in r ? r : { ...r, [key]: "" }
    );
    (store as HubStore)[collection] = rows as never;
  });

  return { key };
}

export async function removeField(collection: string, name: string) {
  if (!isCollectionKey(collection)) throw new Error("Unknown collection");
  const def = getCollection(collection)!;
  const core = def.fields.find((f) => f.key === name);
  if (core?.locked) throw new Error("Cannot remove locked field");

  const extras = await readExtras();
  extras[collection] = (extras[collection] ?? []).filter((k) => k !== name);
  await writeExtras(extras);

  await updateStore((store) => {
    const rows = asRows(store, collection).map((r) => {
      if (!(name in r)) return r;
      const next = { ...r };
      delete next[name];
      return next;
    });
    (store as HubStore)[collection] = rows as never;
  });
}
