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
  name: string;
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

export async function listMediaFromSupabase(): Promise<{
  items: MediaListItem[];
  tableName: string | null;
}> {
  const tables = await listCoreTables();
  const mediaTable = findMediaTable(tables);
  if (!mediaTable) {
    return { items: [], tableName: null };
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

      return {
        id,
        name: name.trim(),
        category:
          asString(
            pickField(r, [
              /^hub_?category$/i,
              /^category$/i,
              /^folder$/i,
              /^type$/i,
            ])
          ) || "General",
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
    .sort((a, b) => a.name.localeCompare(b.name));

  return { items, tableName: mediaTable.name };
}
