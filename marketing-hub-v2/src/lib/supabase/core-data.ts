import { createServiceClient } from "@/lib/supabase/admin";

export type CoreTable = {
  id: string;
  name: string;
  supabase_table: string;
};

export { createServiceClient };

export async function listCoreTables(): Promise<CoreTable[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("tables")
    .select("id,name,supabase_table")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as CoreTable[];
}

function norm(name: string) {
  return name.trim().toLowerCase();
}

/** Dedicated Events table — not Content-as-events. */
export function findEventsTable(tables: CoreTable[]): CoreTable | undefined {
  const byPhysical = tables.find((t) =>
    /^table_events(_|$)/i.test(t.supabase_table)
  );
  if (byPhysical) return byPhysical;
  const exact = tables.find((t) => norm(t.name) === "events");
  if (exact) return exact;
  return tables.find((t) => {
    const n = norm(t.name);
    return /^events?$/.test(n) || (n.includes("event") && !n.includes("content"));
  });
}

/**
 * Social Posts = day-to-day content for the hub.
 * Prefer over the legacy Content table.
 */
export function findSocialPostsTable(tables: CoreTable[]): CoreTable | undefined {
  const byPhysical = tables.find((t) =>
    /^table_social_posts(_|$)/i.test(t.supabase_table)
  );
  if (byPhysical) return byPhysical;
  const exact = tables.find((t) => {
    const n = norm(t.name);
    return n === "social posts" || n === "social post";
  });
  if (exact) return exact;
  return tables.find((t) => {
    const n = norm(t.name);
    return n.includes("social") && n.includes("post") && !n.includes("content planner");
  });
}

/** Legacy Content table — keep for reference only; not canonical for Events or Social. */
export function findLegacyContentTable(tables: CoreTable[]): CoreTable | undefined {
  return tables.find((t) => norm(t.name) === "content");
}

export function findContactsTable(tables: CoreTable[]): CoreTable | undefined {
  const byPhysical = tables.find((t) =>
    /^table_contact(_|$)/i.test(t.supabase_table)
  );
  if (byPhysical) return byPhysical;
  const singular = tables.find((t) => norm(t.name) === "contact");
  if (singular) return singular;
  const plural = tables.find((t) => norm(t.name) === "contacts");
  if (plural) return plural;
  return tables.find((t) => /contact/i.test(t.name));
}

export function findThemesTable(tables: CoreTable[]): CoreTable | undefined {
  const byPhysical = tables.find((t) =>
    /^table_quarterly_themes(_|$)/i.test(t.supabase_table)
  );
  if (byPhysical) return byPhysical;
  return tables.find(
    (t) => /quarterly/i.test(t.name) && /theme/i.test(t.name)
  );
}

export function findAwardsTable(tables: CoreTable[]): CoreTable | undefined {
  const byPhysical = tables.find((t) =>
    /^table_awards(_|$)/i.test(t.supabase_table)
  );
  if (byPhysical) return byPhysical;
  const exact = tables.find((t) => norm(t.name) === "awards");
  if (exact) return exact;
  return tables.find((t) => /award/i.test(t.name));
}

export function findMembershipsTable(tables: CoreTable[]): CoreTable | undefined {
  const byPhysical = tables.find((t) =>
    /^table_memberships(_|$)/i.test(t.supabase_table)
  );
  if (byPhysical) return byPhysical;
  const exact = tables.find((t) => norm(t.name) === "memberships");
  if (exact) return exact;
  return tables.find((t) => /membership/i.test(t.name));
}

export function findTasksTable(tables: CoreTable[]): CoreTable | undefined {
  const byPhysical = tables.find((t) =>
    /^table_tasks(_|$)/i.test(t.supabase_table)
  );
  if (byPhysical) return byPhysical;
  const exact = tables.find((t) => norm(t.name) === "tasks");
  if (exact) return exact;
  return tables.find((t) => /task/i.test(t.name));
}

export function findSponsorshipsTable(tables: CoreTable[]): CoreTable | undefined {
  const matches = tables.filter((t) => /sponsorship/i.test(t.name));
  // Prefer newer physical table name (higher timestamp suffix) when duplicates exist
  return matches.sort((a, b) =>
    b.supabase_table.localeCompare(a.supabase_table)
  )[0];
}

/** Media Links Resources — logos, presentations, docs, attached files. */
export function findMediaTable(tables: CoreTable[]): CoreTable | undefined {
  const byPhysical = tables.find((t) =>
    /^table_media(_|$)/i.test(t.supabase_table)
  );
  if (byPhysical) return byPhysical;
  const exact = tables.find((t) => {
    const n = norm(t.name);
    return (
      n === "media links resources" ||
      n === "media" ||
      n === "media links"
    );
  });
  if (exact) return exact;
  return tables.find((t) => {
    const n = norm(t.name);
    return n.includes("media") && (n.includes("link") || n.includes("resource"));
  });
}

export function pickField(
  row: Record<string, unknown>,
  candidates: RegExp[]
): unknown {
  const keys = Object.keys(row);
  for (const re of candidates) {
    const key = keys.find((k) => re.test(k));
    if (key != null && row[key] != null && row[key] !== "") return row[key];
  }
  return undefined;
}

export function asString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v)))
      .filter(Boolean)
      .join(", ");
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.name === "string") return obj.name;
    if (typeof obj.label === "string") return obj.label;
    if (typeof obj.title === "string") return obj.title;
  }
  return String(value);
}

export function asIsoDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  const s = String(value);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
