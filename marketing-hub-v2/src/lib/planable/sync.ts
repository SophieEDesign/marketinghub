import {
  createContent,
  listContent,
  updateContent,
  withContentPlanableDefaults,
} from "@/lib/data/repos";
import {
  isSocialContentItem,
  joinAssetUrls,
  normalizeChannels,
  primaryImageUrl,
} from "@/lib/data/normalize";
import { plainTextFromHtml } from "@/lib/sanitize";
import type { ContentItem } from "@/lib/types";
import {
  channelToPageIds,
  createPlanablePost,
  dueDateFromScheduledAt,
  getPlanableConfig,
  hubStatusFromPlanable,
  listAllPlanablePosts,
  listPlanablePages,
  planableDeepLink,
  scheduledAtFromDueDate,
  updatePlanablePost,
  uploadPlanableMediaFromUrl,
  type PlanableRawPost,
} from "@/lib/planable/client";

export type PlanableSyncResult = {
  configured: boolean;
  created: number;
  updated: number;
  skipped: number;
  lockedPublished: number;
  error?: string;
  openUrl: string;
};

type PostGroup = {
  key: string;
  groupId: string;
  posts: PlanableRawPost[];
};

function groupPlanablePosts(posts: PlanableRawPost[]): PostGroup[] {
  const map = new Map<string, PlanableRawPost[]>();
  for (const post of posts) {
    if (post.archived) continue;
    const key = post.groupId || post.id;
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(post);
    map.set(key, list);
  }
  return Array.from(map.entries()).map(([key, groupPosts]) => ({
    key,
    groupId: groupPosts[0]?.groupId || "",
    posts: groupPosts,
  }));
}

function captionFromGroup(posts: PlanableRawPost[]): string {
  const withText = posts.find((p) => p.plainText.trim());
  return (withText?.plainText || "").trim();
}

function titleFromCaption(caption: string): string {
  const line = caption.split(/\n/)[0]?.trim() || "Untitled post";
  return line.slice(0, 120);
}

function channelsFromGroup(posts: PlanableRawPost[]): string[] {
  const set = new Set<string>();
  for (const p of posts) {
    for (const ch of p.platforms) {
      const n = normalizeChannels([ch]);
      for (const c of n) set.add(c);
    }
  }
  return Array.from(set);
}

function mediaFromGroup(posts: PlanableRawPost[]): string {
  const urls: string[] = [];
  for (const p of posts) {
    for (const u of p.mediaUrls) {
      if (u && !urls.includes(u)) urls.push(u);
    }
  }
  return joinAssetUrls(urls);
}

function findExistingForGroup(
  content: ContentItem[],
  group: PostGroup
): ContentItem | undefined {
  const postIds = new Set(group.posts.map((p) => p.id));
  const byPost = content.find(
    (c) => c.planable_post_id && postIds.has(c.planable_post_id)
  );
  if (byPost) return byPost;

  if (group.groupId) {
    const byGroup = content.find(
      (c) => c.planable_group_id && c.planable_group_id === group.groupId
    );
    if (byGroup) return byGroup;
  }

  for (const p of group.posts) {
    const byUrl = content.find(
      (c) =>
        c.planable_url &&
        (c.planable_url.includes(p.id) ||
          (p.url && c.planable_url.includes(p.url)))
    );
    if (byUrl) return byUrl;
  }

  return undefined;
}

function isHubDirty(item: ContentItem): boolean {
  if (item.sync_source !== "hub") return false;
  if (!item.last_synced_at) return true;
  return (
    new Date(item.updated_at).getTime() > new Date(item.last_synced_at).getTime()
  );
}

/** Pull Planable → Hub social ContentItems. */
export async function syncPlanableIntoHub(): Promise<PlanableSyncResult> {
  const config = getPlanableConfig();
  const listed = await listAllPlanablePosts();
  if (!listed.configured) {
    return {
      configured: false,
      created: 0,
      updated: 0,
      skipped: 0,
      lockedPublished: 0,
      openUrl: listed.openUrl,
      error: listed.error,
    };
  }
  if (listed.error && listed.posts.length === 0) {
    return {
      configured: true,
      created: 0,
      updated: 0,
      skipped: 0,
      lockedPublished: 0,
      openUrl: listed.openUrl,
      error: listed.error,
    };
  }

  const existing = (await listContent()).map(withContentPlanableDefaults);
  const groups = groupPlanablePosts(listed.posts);
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let lockedPublished = 0;
  const now = new Date().toISOString();

  for (const group of groups) {
    const primary =
      group.posts.find((p) => p.plainText.trim()) || group.posts[0];
    if (!primary) {
      skipped += 1;
      continue;
    }

    const published = group.posts.some((p) => p.published);
    const approved = group.posts.some((p) => p.approved);
    const scheduledSet = group.posts.some((p) => p.scheduledSet);
    const caption = captionFromGroup(group.posts);
    const channels = channelsFromGroup(group.posts);
    const due_date = dueDateFromScheduledAt(
      group.posts.map((p) => p.scheduledAt).find(Boolean) ?? null
    );
    const asset_url = mediaFromGroup(group.posts);
    const pageIds = Array.from(
      new Set(
        group.posts.flatMap((p) =>
          p.groupPageIds.length
            ? p.groupPageIds
            : p.pageId
              ? [p.pageId]
              : []
        )
      )
    );
    const status = hubStatusFromPlanable({
      published,
      approved,
      scheduledAt: primary.scheduledAt,
      scheduledSet,
    });
    const planable_url =
      primary.url || planableDeepLink(primary.id, config);

    const match = findExistingForGroup(existing, group);
    if (match) {
      if (published) lockedPublished += 1;

      if (isHubDirty(match) && !published) {
        // Still refresh published lock / ids if needed
        if (
          !match.planable_post_id ||
          match.planable_post_id !== primary.id
        ) {
          await updateContent(match.id, {
            planable_post_id: primary.id,
            planable_group_id: group.groupId || match.planable_group_id,
            planable_page_ids: pageIds.length
              ? pageIds
              : match.planable_page_ids,
            planable_url: match.planable_url || planable_url,
          });
        }
        skipped += 1;
        continue;
      }

      await updateContent(match.id, {
        title: match.title?.trim() || titleFromCaption(caption),
        caption: caption || match.caption,
        channel: channels.length ? channels : match.channel,
        content_type: "Social",
        due_date: due_date ?? match.due_date,
        status: published ? "published" : status,
        asset_url: asset_url || match.asset_url,
        planable_url: planable_url || match.planable_url,
        planable_post_id: primary.id,
        planable_group_id: group.groupId || match.planable_group_id,
        planable_page_ids: pageIds,
        last_synced_at: now,
        sync_source: "planable",
      });
      updated += 1;
      continue;
    }

    const item = await createContent({
      title: titleFromCaption(caption),
      channel: channels.length ? channels : ["LinkedIn"],
      content_type: "Social",
      owner: "",
      due_date,
      deadline_date: null,
      status: published ? "published" : status,
      category: "Social Media",
      priority: "",
      website: "",
      caption,
      theme_id: null,
      planable_url,
      planable_post_id: primary.id,
      planable_group_id: group.groupId,
      planable_page_ids: pageIds,
      last_synced_at: now,
      sync_source: "planable",
      asset_url,
      notes: "",
    });
    existing.push(item);
    created += 1;
    if (published) lockedPublished += 1;
  }

  return {
    configured: true,
    created,
    updated,
    skipped,
    lockedPublished,
    openUrl: listed.openUrl,
    ...(listed.error ? { error: listed.error } : {}),
  };
}

function plainCaption(item: ContentItem): string {
  const caption = plainTextFromHtml(item.caption || "").trim();
  if (caption) return caption;
  const notes = plainTextFromHtml(item.notes || "").trim();
  if (notes) return notes;
  return (item.title || "").trim() || "Untitled post";
}

/** Push a Hub social ContentItem to Planable (create or update). */
export async function pushContentToPlanable(
  item: ContentItem
): Promise<{ item: ContentItem; error?: string }> {
  const current = withContentPlanableDefaults(item);
  if (!isSocialContentItem(current)) {
    return { item: current };
  }
  if (current.status === "published") {
    return { item: current };
  }

  const config = getPlanableConfig();
  if (!config.configured) {
    return {
      item: current,
      error: "Planable is not configured.",
    };
  }

  const pagesResult = await listPlanablePages();
  if (!pagesResult.configured || pagesResult.pages.length === 0) {
    return {
      item: current,
      error: pagesResult.error || "No Planable pages available.",
    };
  }

  const pageIds =
    current.planable_page_ids.length > 0
      ? current.planable_page_ids
      : channelToPageIds(current.channel, pagesResult.pages);

  if (pageIds.length === 0) {
    return {
      item: current,
      error:
        "No Planable page matches the selected channels. Connect pages in Planable or pick LinkedIn/Instagram/etc.",
    };
  }

  const plainText = plainCaption(current);
  const scheduledAt = scheduledAtFromDueDate(current.due_date);
  const imageUrl = primaryImageUrl(current.asset_url);
  let mediaUrls: string[] | undefined;
  if (imageUrl) {
    const uploaded = await uploadPlanableMediaFromUrl(imageUrl);
    if (uploaded.ok) mediaUrls = [uploaded.mediaUrl];
    else mediaUrls = [imageUrl];
  }

  const now = new Date().toISOString();

  // Update existing linked post(s)
  if (current.planable_post_id) {
    const idsToPatch = [current.planable_post_id];
    // Best-effort: also patch sibling ids stored via page list if we only have primary
    let lastError: string | undefined;
    for (const id of idsToPatch) {
      const result = await updatePlanablePost(id, {
        plainText,
        scheduledAt,
        ...(mediaUrls ? { media: mediaUrls } : {}),
      });
      if (!result.ok) {
        lastError = result.error;
        // Published posts cannot be patched — treat as lock
        if (/publish/i.test(result.error)) {
          const locked = await updateContent(current.id, {
            status: "published",
            sync_source: "planable",
            last_synced_at: now,
          });
          return {
            item: locked ?? current,
            error: "Post is published in Planable and is locked in the Hub.",
          };
        }
      }
    }

    const patched = await updateContent(current.id, {
      planable_page_ids: pageIds,
      planable_url:
        current.planable_url || planableDeepLink(current.planable_post_id),
      last_synced_at: now,
      sync_source: "hub",
    });
    return {
      item: patched ?? current,
      ...(lastError ? { error: lastError } : {}),
    };
  }

  // Create one post per mapped page (Planable multi-page grouping is best-effort)
  const createdIds: string[] = [];
  let groupId = "";
  let primaryId = "";
  let lastError: string | undefined;

  for (const pageId of pageIds) {
    const created = await createPlanablePost({
      pageId,
      plainText,
      scheduledAt,
    });
    if (!created.ok) {
      lastError = created.error;
      continue;
    }
    createdIds.push(created.post.id);
    if (!primaryId) primaryId = created.post.id;
    if (created.post.groupId) groupId = created.post.groupId;

    if (mediaUrls?.length) {
      await updatePlanablePost(created.post.id, { media: mediaUrls });
    }
  }

  if (!primaryId) {
    return {
      item: current,
      error: lastError || "Failed to create Planable draft.",
    };
  }

  const patched = await updateContent(current.id, {
    planable_post_id: primaryId,
    planable_group_id: groupId,
    planable_page_ids: pageIds,
    planable_url: planableDeepLink(primaryId),
    last_synced_at: now,
    sync_source: "hub",
    status:
      current.status === "idea" || current.status === "draft"
        ? current.due_date
          ? "scheduled"
          : "draft"
        : current.status,
  });

  return {
    item: patched ?? current,
    ...(lastError ? { error: lastError } : {}),
  };
}
