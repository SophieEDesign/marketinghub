import type { MediaListItem } from "@/lib/supabase/media-list";

/** Strip download URLs from media items when the caller lacks download access. */
export function redactMediaItemsForPublic(
  items: MediaListItem[],
  canDownload: boolean
): MediaListItem[] {
  if (canDownload) return items;
  return items.map((item) => ({
    ...item,
    notes: "",
    document_url: "",
    document_link: "",
    cover_url: item.cover_url,
    files: item.files.map((f) => ({
      ...f,
      url: "",
    })),
  }));
}
