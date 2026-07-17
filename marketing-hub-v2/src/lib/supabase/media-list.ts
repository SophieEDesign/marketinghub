import {
  asString,
  createServiceClient,
  findMediaTable,
  listCoreTables,
  pickField,
} from "@/lib/supabase/core-data";

export type MediaFile = {
  url: string;
  name: string;
  type: string;
  size: number | null;
};

export type MediaListItem = {
  id: string;
  /** Internal name (staff reference). */
  name: string;
  /** Public gallery title; falls back to `name` when empty. */
  public_title: string;
  /** Title to show in the current context (public vs staff). */
  display_name: string;
  category: string;
  status: string;
  owned_by: string;
  notes: string;
  document_url: string;
  document_link: string;
  files: MediaFile[];
  cover_url: string | null;
  updated_at: string | null;
};

/** Categories visible on the public /media gallery. Gallery/Images to follow later. */
export const PUBLIC_MEDIA_CATEGORIES = ["Logos", "Presentations"] as const;

export type MediaListScope = "public" | "all";

function parseFiles(raw: unknown): MediaFile[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const obj = entry as Record<string, unknown>;
      const url = asString(obj.url ?? obj.href ?? obj.src);
      if (!url) return null;
      return {
        url,
        name: asString(obj.name ?? obj.filename ?? "File") || "File",
        type: asString(obj.type ?? obj.mimeType ?? ""),
        size:
          typeof obj.size === "number"
            ? obj.size
            : Number.isFinite(Number(obj.size))
              ? Number(obj.size)
              : null,
      };
    })
    .filter((f): f is MediaFile => !!f);
}

function extractUrlFromDocumentField(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const match = trimmed.match(/\((https?:\/\/[^)]+)\)/i);
  if (match?.[1]) return match[1];
  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(trimmed) && !trimmed.includes(" ")) {
    return `https://${trimmed}`;
  }
  return "";
}

function normalizeLink(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function isPublicCategory(category: string): boolean {
  const normalized = category.trim().toLowerCase();
  return PUBLIC_MEDIA_CATEGORIES.some((c) => c.toLowerCase() === normalized);
}

export async function listMediaFromSupabase(options?: {
  scope?: MediaListScope;
}): Promise<{
  items: MediaListItem[];
  tableName: string | null;
  scope: MediaListScope;
}> {
  const scope: MediaListScope = options?.scope === "all" ? "all" : "public";
  const tables = await listCoreTables();
  const mediaTable = findMediaTable(tables);
  if (!mediaTable) {
    return { items: [], tableName: null, scope };
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from(mediaTable.supabase_table)
    .select("*")
    .limit(1000);

  if (error) {
    throw new Error(error.message);
  }

  const items = ((data ?? []) as Record<string, unknown>[])
    .filter((r) => r.deleted_at == null)
    .map((r) => {
      const id = asString(r.id);
      const name =
        asString(pickField(r, [/^name$/i, /^title$/i, /^asset$/i])) ||
        "Untitled asset";
      const publicTitle = asString(
        pickField(r, [/^public_?title$/i, /^display_?title$/i, /^public_?name$/i])
      );
      const files = parseFiles(
        pickField(r, [/^media$/i, /^attachments?/i, /^files?/i, /^images?/i])
      );
      const documentRaw = asString(
        pickField(r, [/^document$/i, /^file$/i, /^attachment$/i])
      );
      const document_url = extractUrlFromDocumentField(documentRaw);
      const document_link = normalizeLink(
        asString(
          pickField(r, [
            /^document_?link$/i,
            /^link$/i,
            /^url$/i,
            /^onedrive/i,
          ])
        )
      );
      const cover =
        files.find((f) => f.type.startsWith("image/"))?.url ??
        files[0]?.url ??
        null;
      const category =
        asString(
          pickField(r, [
            /^hub_?category$/i,
            /^category$/i,
            /^folder$/i,
            /^type$/i,
          ])
        ) || "General";

      const internalName = name.trim();
      const publicName = publicTitle.trim();
      const display_name =
        scope === "public"
          ? publicName || internalName
          : internalName;

      return {
        id,
        name: internalName,
        public_title: publicName,
        display_name,
        category,
        status: asString(pickField(r, [/^status$/i])) || "",
        owned_by: asString(
          pickField(r, [/^owned_?by$/i, /^owner$/i, /^assignee$/i])
        ),
        notes: asString(pickField(r, [/^notes$/i, /^description$/i])),
        document_url,
        document_link,
        files,
        cover_url: cover,
        updated_at: asString(r.updated_at) || null,
      } satisfies MediaListItem;
    })
    .filter((item) => (scope === "public" ? isPublicCategory(item.category) : true))
    .sort((a, b) => a.display_name.localeCompare(b.display_name));

  return { items, tableName: mediaTable.name, scope };
}

export const MEDIA_HUB_CATEGORIES = [
  "Logos",
  "Presentations",
  "Images",
  "Documents",
  "Brand Guidelines",
  "Design Assets",
  "Templates",
  "Flyers",
  "Advertorial",
] as const;

export type CreateMediaInput = {
  name: string;
  public_title?: string;
  category?: string;
  document_link?: string;
  notes?: string;
  status?: string;
  /** Optional uploaded / linked file for the media jsonb column. */
  file?: { url: string; name: string; type?: string; size?: number | null };
  /** auth.users id — required for created_by / updated_by FKs. */
  actorId: string;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

/** Resolve a valid auth.users id for Core Data audit columns. */
export async function resolveMediaActorId(
  preferredId: string
): Promise<string> {
  if (isUuid(preferredId)) return preferredId;

  const tables = await listCoreTables();
  const mediaTable = findMediaTable(tables);
  if (!mediaTable) {
    throw new Error("Media Links Resources table not found");
  }

  const supabase = createServiceClient();
  const { data } = await supabase
    .from(mediaTable.supabase_table)
    .select("created_by")
    .not("created_by", "is", null)
    .limit(1);

  const fallback = asString((data?.[0] as { created_by?: unknown } | undefined)?.created_by);
  if (isUuid(fallback)) return fallback;

  throw new Error(
    "Could not resolve a Supabase user for media create. Sign in with a real account."
  );
}

export async function createMediaInSupabase(
  input: CreateMediaInput
): Promise<MediaListItem> {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");

  const tables = await listCoreTables();
  const mediaTable = findMediaTable(tables);
  if (!mediaTable) {
    throw new Error("Media Links Resources table not found");
  }

  const actorId = await resolveMediaActorId(input.actorId);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const category = (input.category?.trim() || "Documents").trim();
  const publicTitle = input.public_title?.trim() || "";
  const documentLink = normalizeLink(input.document_link ?? "");
  const notes = input.notes?.trim() || "";
  const status = input.status?.trim() || "Internal Resource";

  const media =
    input.file?.url
      ? [
          {
            url: input.file.url,
            name: input.file.name || "File",
            type: input.file.type || "",
            size:
              typeof input.file.size === "number" ? input.file.size : null,
          },
        ]
      : null;

  const row = {
    id,
    name,
    public_title: publicTitle || null,
    hub_category: category,
    document_link: documentLink || null,
    notes: notes || null,
    status,
    media,
    created_at: now,
    updated_at: now,
    created_by: actorId,
    updated_by: actorId,
    deleted_at: null,
  };

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from(mediaTable.supabase_table)
    .insert(row)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const r = data as Record<string, unknown>;
  const files = parseFiles(r.media);
  return {
    id: asString(r.id),
    name,
    public_title: publicTitle,
    display_name: name,
    category,
    status,
    owned_by: asString(r.owned_by),
    notes,
    document_url: extractUrlFromDocumentField(asString(r.document)),
    document_link: documentLink,
    files,
    cover_url:
      files.find((f) => f.type.startsWith("image/"))?.url ??
      files[0]?.url ??
      null,
    updated_at: asString(r.updated_at) || now,
  };
}

export async function softDeleteMediaInSupabase(
  id: string,
  actorId: string
): Promise<void> {
  if (!id.trim()) throw new Error("id is required");

  const tables = await listCoreTables();
  const mediaTable = findMediaTable(tables);
  if (!mediaTable) {
    throw new Error("Media Links Resources table not found");
  }

  const resolvedActor = await resolveMediaActorId(actorId);
  const supabase = createServiceClient();
  const { error } = await supabase
    .from(mediaTable.supabase_table)
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: resolvedActor,
    })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
}
