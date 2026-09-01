import {
  isSocialContentItem,
  normalizeChannels,
  stripHtml,
} from "@/lib/data/normalize";
import {
  createContent,
  listContent,
  listEvents,
  listThemes,
  updateContent,
} from "@/lib/data/repos";
import type { ContentItem, ContentStatus } from "@/lib/types";

export type SocialPostSummary = {
  id: string;
  title: string;
  caption: string;
  channels: string[];
  status: ContentStatus;
  content_type: string;
  due_date: string | null;
  theme_id: string | null;
  owner: string;
  notes: string;
  planable_url: string;
  updated_at: string;
};

function toSummary(item: ContentItem): SocialPostSummary {
  return {
    id: item.id,
    title: item.title,
    caption: stripHtml(item.caption),
    channels: item.channel,
    status: item.status,
    content_type: item.content_type,
    due_date: item.due_date,
    theme_id: item.theme_id,
    owner: item.owner,
    notes: stripHtml(item.notes),
    planable_url: item.planable_url,
    updated_at: item.updated_at,
  };
}

export async function listSocialPosts(input: {
  status?: string;
  channel?: string;
  search?: string;
  limit?: number;
}): Promise<SocialPostSummary[]> {
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const status = input.status?.trim().toLowerCase();
  const channel = input.channel?.trim().toLowerCase();
  const search = input.search?.trim().toLowerCase();

  let items = (await listContent()).filter(isSocialContentItem);

  if (status) {
    items = items.filter((item) => item.status.toLowerCase() === status);
  }
  if (channel) {
    items = items.filter((item) =>
      item.channel.some((ch) => ch.toLowerCase().includes(channel))
    );
  }
  if (search) {
    items = items.filter((item) => {
      const haystack = `${item.title} ${stripHtml(item.caption)} ${item.notes}`
        .toLowerCase()
        .trim();
      return haystack.includes(search);
    });
  }

  items.sort((a, b) => {
    const aTime = a.updated_at || a.created_at;
    const bTime = b.updated_at || b.created_at;
    return bTime.localeCompare(aTime);
  });

  return items.slice(0, limit).map(toSummary);
}

export async function getSocialPost(id: string) {
  const item = (await listContent()).find((c) => c.id === id);
  if (!item) return null;
  return toSummary(item);
}

export async function createSocialDraft(input: {
  title: string;
  caption?: string;
  channels?: string[];
  due_date?: string | null;
  theme_id?: string | null;
  owner?: string;
  notes?: string;
  status?: ContentStatus;
}) {
  const title = input.title.trim() || "Untitled draft";
  const channels = normalizeChannels(
    input.channels ?? ["LinkedIn"],
    title,
    input.notes ?? ""
  );
  const status = input.status ?? "draft";
  if (status === "published") {
    throw new Error(
      "Cannot create as published. Use draft, idea, or review — publish in Planable."
    );
  }

  const item = await createContent({
    title,
    channel: channels,
    content_type: "Social",
    owner: input.owner?.trim() ?? "",
    due_date: input.due_date ?? null,
    deadline_date: null,
    status,
    category: "",
    priority: "",
    website: "",
    caption: input.caption ?? "",
    theme_id: input.theme_id ?? null,
    planable_url: "",
    planable_post_id: "",
    planable_group_id: "",
    planable_page_ids: [],
    last_synced_at: null,
    sync_source: "hub",
    asset_url: "",
    notes: input.notes ?? "",
  });

  return toSummary(item);
}

export async function updateSocialPost(
  id: string,
  patch: {
    title?: string;
    caption?: string;
    channels?: string[];
    due_date?: string | null;
    theme_id?: string | null;
    owner?: string;
    notes?: string;
    status?: ContentStatus;
  }
) {
  const existing = (await listContent()).find((c) => c.id === id);
  if (!existing) return null;
  if (existing.status === "published") {
    throw new Error(
      "Published posts are locked in the Hub. Edit in Planable or delete from the Hub."
    );
  }
  if (patch.status === "published") {
    throw new Error(
      "Publish only in Planable. Sync from Planable to mark published in the Hub."
    );
  }

  const nextPatch: Partial<ContentItem> = {};
  if (patch.title !== undefined) nextPatch.title = patch.title.trim() || existing.title;
  if (patch.caption !== undefined) nextPatch.caption = patch.caption;
  if (patch.channels !== undefined) {
    nextPatch.channel = normalizeChannels(
      patch.channels,
      patch.title ?? existing.title,
      patch.notes ?? existing.notes
    );
  }
  if (patch.due_date !== undefined) nextPatch.due_date = patch.due_date;
  if (patch.theme_id !== undefined) nextPatch.theme_id = patch.theme_id;
  if (patch.owner !== undefined) nextPatch.owner = patch.owner;
  if (patch.notes !== undefined) nextPatch.notes = patch.notes;
  if (patch.status !== undefined) nextPatch.status = patch.status;
  if (isSocialContentItem({ ...existing, ...nextPatch } as ContentItem)) {
    nextPatch.sync_source = "hub";
  }

  const updated = await updateContent(id, nextPatch);
  if (!updated) return null;
  return toSummary(updated);
}

export async function listThemeContext() {
  const themes = await listThemes();
  return themes
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return a.quarter.localeCompare(b.quarter);
    })
    .map((theme) => ({
      id: theme.id,
      title: theme.title,
      quarter: theme.quarter,
      year: theme.year,
      status: theme.status,
      summary: theme.summary,
    }));
}

export async function listUpcomingEvents(limit = 20) {
  const now = new Date().toISOString();
  const events = (await listEvents())
    .filter((event) => event.starts_at && event.starts_at >= now)
    .sort((a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? ""))
    .slice(0, Math.min(Math.max(limit, 1), 50));

  return events.map((event) => ({
    id: event.id,
    title: event.title,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    location: event.location,
    event_type: event.event_type,
    division: event.division,
    notes: event.notes,
    link_url: event.link_url,
  }));
}

export const BRAND_CONTEXT = {
  company: "Peters & May",
  industry: "Yacht transport and logistics",
  tone:
    "Professional, confident, and approachable. Celebrate craftsmanship, global reach, and trusted partnerships without hype.",
  channels: [
    "LinkedIn (primary B2B)",
    "Instagram (visual storytelling)",
    "Facebook",
    "X",
  ],
  reminders: [
    "Drafts created here land in the Hub Social calendar as idea/draft/review.",
    "Approve and publish in Planable — the Hub syncs status back.",
    "Link posts to quarterly themes when relevant (use list_themes).",
    "Check upcoming events for timely post ideas (use list_upcoming_events).",
  ],
};
