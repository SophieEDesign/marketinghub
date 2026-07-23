import { PLATFORM_META, platformKey } from "@/lib/social/platforms";
import type { ContentStatus } from "@/lib/types";

export const PLANABLE_API_BASE_URL = "https://api.planable.io/api/v1";

/** Enough coverage for calendar + inbound sync. */
const PLANABLE_PAGE_SIZE = 100;
const PLANABLE_MAX_POSTS = 500;

export function getPlanableConfig() {
  const token = process.env.PLANABLE_API_TOKEN;
  const workspaceId = process.env.PLANABLE_WORKSPACE_ID;
  const appUrl = process.env.PLANABLE_APP_URL || "https://app.planable.io";
  return {
    configured: Boolean(token && workspaceId),
    token,
    workspaceId,
    appUrl,
    openUrl: workspaceId ? `${appUrl}/w/${workspaceId}` : appUrl,
  };
}

export type PlanablePage = {
  id: string;
  name: string | null;
  platform: string | null;
};

export type PlanablePost = {
  id: string;
  text: string;
  status: string;
  scheduledAt: string | null;
  url: string | null;
  pageName: string | null;
  mediaUrl: string | null;
  platforms: string[];
};

/** Raw Planable post shape used by sync (keeps ids / group / published). */
export type PlanableRawPost = {
  id: string;
  workspaceId: string;
  pageId: string | null;
  groupId: string | null;
  groupPageIds: string[];
  plainText: string;
  scheduledAt: string | null;
  published: boolean;
  approved: boolean;
  /** True when a real schedule was set in Planable (not just a default date). */
  scheduledSet: boolean;
  archived: boolean;
  mediaUrls: string[];
  platforms: string[];
  pageName: string | null;
  url: string | null;
  type: string | null;
};

function authHeaders(token: string, json = false): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

function pickMediaUrls(p: Record<string, unknown>): string[] {
  const out: string[] = [];
  const push = (u: string | null | undefined) => {
    const s = (u ?? "").trim();
    if (s && !out.includes(s)) out.push(s);
  };

  const media = p.media;
  if (typeof media === "string") push(media);
  else if (Array.isArray(media)) {
    for (const item of media) {
      if (typeof item === "string") push(item);
      else if (item && typeof item === "object") {
        const m = item as { url?: string; thumbnailUrl?: string };
        push(m.thumbnailUrl || m.url);
      }
    }
  }

  const attachments = p.attachments as
    | Array<{ url?: string; thumbnail?: string } | string>
    | undefined;
  if (Array.isArray(attachments)) {
    for (const item of attachments) {
      if (typeof item === "string") push(item);
      else if (item && typeof item === "object") {
        push(item.thumbnail || item.url);
      }
    }
  }

  push(p.thumbnailUrl as string | undefined);
  push(p.thumbnail as string | undefined);
  push(p.imageUrl as string | undefined);
  push(p.coverUrl as string | undefined);
  return out;
}

function pickPlatforms(
  p: Record<string, unknown>,
  pagesById: Map<string, PlanablePage>
): string[] {
  const directType =
    (p.type as string | undefined) ||
    (p.platform as string | undefined) ||
    null;
  if (directType && !/^(post|story|reel|video)$/i.test(directType)) {
    return [directType];
  }

  const pages = p.pages as
    | Array<{ name?: string; type?: string; platform?: string }>
    | undefined;
  if (Array.isArray(pages) && pages.length) {
    return pages
      .map((x) => x.platform || x.type || x.name || "")
      .filter(Boolean)
      .map(String);
  }

  const pageId = p.pageId != null ? String(p.pageId) : null;
  if (pageId && pagesById.has(pageId)) {
    const page = pagesById.get(pageId)!;
    if (page.platform) return [page.platform];
    if (page.name) return [page.name];
  }

  const pageName =
    (p.pageName as string | undefined) ||
    (p.page as { name?: string } | undefined)?.name;
  return pageName ? [pageName] : [];
}

export function platformLabelFromPlanable(platform: string | null): string {
  if (!platform) return "Social";
  const key = platformKey(platform);
  return PLATFORM_META[key].label;
}

export async function listPlanablePages(): Promise<{
  configured: boolean;
  pages: PlanablePage[];
  openUrl: string;
  error?: string;
}> {
  const config = getPlanableConfig();
  if (!config.configured || !config.token || !config.workspaceId) {
    return {
      configured: false,
      pages: [],
      openUrl: config.openUrl,
      error: "Set PLANABLE_API_TOKEN and PLANABLE_WORKSPACE_ID to sync posts.",
    };
  }
  const map = await fetchPlanablePages(config.token, config.workspaceId);
  return {
    configured: true,
    pages: Array.from(map.values()),
    openUrl: config.openUrl,
  };
}

async function fetchPlanablePages(
  token: string,
  workspaceId: string
): Promise<Map<string, PlanablePage>> {
  const map = new Map<string, PlanablePage>();
  try {
    const res = await fetch(
      `${PLANABLE_API_BASE_URL}/pages?workspaceId=${encodeURIComponent(workspaceId)}&limit=100`,
      {
        headers: authHeaders(token),
        next: { revalidate: 300 },
      }
    );
    if (!res.ok) return map;
    const data = (await res.json()) as {
      data?: Array<Record<string, unknown>>;
    };
    for (const page of data.data ?? []) {
      const id = page.id != null ? String(page.id) : "";
      if (!id) continue;
      map.set(id, {
        id,
        name: page.name != null ? String(page.name) : null,
        platform:
          page.platform != null
            ? String(page.platform)
            : page.type != null
              ? String(page.type)
              : null,
      });
    }
  } catch {
    /* pages optional */
  }
  return map;
}

/**
 * Map Hub channel labels to Planable page ids.
 * Prefers connected pages; one page per platform key.
 */
export function channelToPageIds(
  channels: string[],
  pages: PlanablePage[]
): string[] {
  const byPlatform = new Map<string, PlanablePage[]>();
  for (const page of pages) {
    const key = platformKey(page.platform ?? page.name ?? "");
    const list = byPlatform.get(key) ?? [];
    list.push(page);
    byPlatform.set(key, list);
  }

  const ids: string[] = [];
  for (const ch of channels) {
    const key = platformKey(ch);
    const candidates = byPlatform.get(key) ?? [];
    const page = candidates[0];
    if (page && !ids.includes(page.id)) ids.push(page.id);
  }
  return ids;
}

function toRawPost(
  p: Record<string, unknown>,
  pagesById: Map<string, PlanablePage>
): PlanableRawPost {
  const id = String(p.id ?? p._id ?? "");
  const pageId = p.pageId != null ? String(p.pageId) : null;
  const groupId = p.groupId != null ? String(p.groupId) : null;
  const groupPageIds = Array.isArray(p.groupPageIds)
    ? (p.groupPageIds as unknown[]).map(String).filter(Boolean)
    : pageId
      ? [pageId]
      : [];
  const scheduled =
    (p.scheduledAt as string | undefined) ||
    (p.scheduled_at as string | undefined) ||
    (p.publishAt as string | undefined) ||
    null;
  const platforms = pickPlatforms(p, pagesById).map(platformLabelFromPlanable);
  const page = pageId ? pagesById.get(pageId) : undefined;
  return {
    id,
    workspaceId: String(p.workspaceId ?? ""),
    pageId,
    groupId,
    groupPageIds,
    plainText: String(
      p.plainText ?? p.text ?? p.caption ?? p.title ?? ""
    ).trim(),
    scheduledAt: scheduled,
    published: p.published === true,
    approved: p.approved === true,
    scheduledSet: p.scheduledSet === true,
    archived: p.archived === true,
    mediaUrls: pickMediaUrls(p),
    platforms:
      platforms.length > 0
        ? platforms
        : page?.platform
          ? [platformLabelFromPlanable(page.platform)]
          : [],
    pageName: page?.name ?? null,
    url: (p.url as string | undefined) ?? null,
    type: p.type != null ? String(p.type) : null,
  };
}

async function fetchRawPostsPage(
  token: string,
  workspaceId: string,
  offset: number,
  limit: number
): Promise<{
  posts: Array<Record<string, unknown>>;
  hasMore: boolean;
  error?: string;
}> {
  const res = await fetch(
    `${PLANABLE_API_BASE_URL}/posts?workspaceId=${encodeURIComponent(workspaceId)}&limit=${limit}&offset=${offset}`,
    {
      headers: authHeaders(token),
      next: { revalidate: 120 },
    }
  );
  if (!res.ok) {
    const text = await res.text();
    return {
      posts: [],
      hasMore: false,
      error: `Planable API ${res.status}: ${text.slice(0, 200)}`,
    };
  }
  const data = (await res.json()) as {
    data?: Array<Record<string, unknown>>;
    posts?: Array<Record<string, unknown>>;
    pagination?: { hasMore?: boolean };
  };
  const batch = data.data ?? data.posts ?? [];
  return {
    posts: batch,
    hasMore: Boolean(data.pagination?.hasMore) && batch.length > 0,
  };
}

export async function listAllPlanablePosts(options?: {
  maxPosts?: number;
}): Promise<{
  configured: boolean;
  posts: PlanableRawPost[];
  pages: PlanablePage[];
  openUrl: string;
  error?: string;
}> {
  const config = getPlanableConfig();
  const maxPosts = options?.maxPosts ?? PLANABLE_MAX_POSTS;
  if (!config.configured || !config.token || !config.workspaceId) {
    return {
      configured: false,
      posts: [],
      pages: [],
      openUrl: config.openUrl,
      error: "Set PLANABLE_API_TOKEN and PLANABLE_WORKSPACE_ID to sync posts.",
    };
  }

  try {
    const pagesById = await fetchPlanablePages(
      config.token,
      config.workspaceId
    );
    const rawPosts: Array<Record<string, unknown>> = [];
    let offset = 0;
    let error: string | undefined;

    while (rawPosts.length < maxPosts) {
      const limit = Math.min(PLANABLE_PAGE_SIZE, maxPosts - rawPosts.length);
      const page = await fetchRawPostsPage(
        config.token,
        config.workspaceId,
        offset,
        limit
      );
      if (page.error) {
        error = page.error;
        break;
      }
      rawPosts.push(...page.posts);
      if (!page.hasMore) break;
      offset += page.posts.length;
    }

    return {
      configured: true,
      posts: rawPosts
        .filter((p) => p.id != null)
        .map((p) => toRawPost(p, pagesById)),
      pages: Array.from(pagesById.values()),
      openUrl: config.openUrl,
      ...(error ? { error } : {}),
    };
  } catch (e) {
    return {
      configured: true,
      posts: [],
      pages: [],
      openUrl: config.openUrl,
      error: e instanceof Error ? e.message : "Planable fetch failed",
    };
  }
}

export async function fetchPlanablePosts(): Promise<{
  configured: boolean;
  posts: PlanablePost[];
  openUrl: string;
  error?: string;
}> {
  const result = await listAllPlanablePosts({ maxPosts: 300 });
  return {
    configured: result.configured,
    posts: result.posts.map((p) => ({
      id: p.id,
      text: p.plainText.slice(0, 280) || "Untitled post",
      status: (() => {
        const hub = hubStatusFromPlanable(p);
        if (hub === "published") return "Published";
        if (hub === "scheduled") return "Scheduled";
        if (hub === "review") return "Review";
        return "Draft";
      })(),
      scheduledAt: p.scheduledAt,
      url: p.url,
      pageName: p.pageName,
      mediaUrl: p.mediaUrls[0] ?? null,
      platforms: p.platforms,
    })),
    openUrl: result.openUrl,
    ...(result.error ? { error: result.error } : {}),
  };
}

function extractPostFromResponse(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;
  if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
    return obj.data as Record<string, unknown>;
  }
  if (Array.isArray(obj.data) && obj.data[0]) {
    return obj.data[0] as Record<string, unknown>;
  }
  if (obj.id != null) return obj;
  return null;
}

export async function createPlanablePost(input: {
  pageId: string;
  plainText: string;
  scheduledAt?: string | null;
}): Promise<{ ok: true; post: PlanableRawPost } | { ok: false; error: string }> {
  const config = getPlanableConfig();
  if (!config.configured || !config.token || !config.workspaceId) {
    return { ok: false, error: "Planable is not configured." };
  }

  const body: Record<string, unknown> = {
    workspaceId: config.workspaceId,
    pageId: input.pageId,
    plainText: input.plainText,
  };
  if (input.scheduledAt) body.scheduledAt = input.scheduledAt;

  try {
    const res = await fetch(`${PLANABLE_API_BASE_URL}/posts`, {
      method: "POST",
      headers: authHeaders(config.token, true),
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* ignore */
    }
    if (!res.ok) {
      const err = (json as { error?: { message?: string } } | null)?.error
        ?.message;
      return {
        ok: false,
        error: err || `Planable create ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    const raw = extractPostFromResponse(json);
    if (!raw?.id) {
      // Some responses return 201 with empty/minimal body — re-list won't help reliably.
      return {
        ok: false,
        error: "Planable created the post but returned no id.",
      };
    }
    const pagesById = await fetchPlanablePages(
      config.token,
      config.workspaceId
    );
    return { ok: true, post: toRawPost(raw, pagesById) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Planable create failed",
    };
  }
}

export async function updatePlanablePost(
  postId: string,
  patch: {
    plainText?: string;
    scheduledAt?: string | null;
    media?: string[];
  }
): Promise<{ ok: true; post?: PlanableRawPost } | { ok: false; error: string }> {
  const config = getPlanableConfig();
  if (!config.configured || !config.token || !config.workspaceId) {
    return { ok: false, error: "Planable is not configured." };
  }

  const body: Record<string, unknown> = {};
  if (patch.plainText !== undefined) body.plainText = patch.plainText;
  if (patch.scheduledAt !== undefined && patch.scheduledAt !== null) {
    body.scheduledAt = patch.scheduledAt;
  }
  if (patch.media !== undefined) body.media = patch.media;
  if (Object.keys(body).length === 0) {
    return { ok: false, error: "No Planable fields to update." };
  }

  try {
    const res = await fetch(`${PLANABLE_API_BASE_URL}/posts/${postId}`, {
      method: "PATCH",
      headers: authHeaders(config.token, true),
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* ignore */
    }
    if (!res.ok) {
      const err = (json as { error?: { message?: string } } | null)?.error
        ?.message;
      return {
        ok: false,
        error: err || `Planable update ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    const raw = extractPostFromResponse(json);
    if (raw?.id) {
      const pagesById = await fetchPlanablePages(
        config.token,
        config.workspaceId
      );
      return { ok: true, post: toRawPost(raw, pagesById) };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Planable update failed",
    };
  }
}

export async function getPlanablePost(
  postId: string
): Promise<
  | { ok: true; post: PlanableRawPost }
  | { ok: false; notFound?: boolean; error: string }
> {
  const config = getPlanableConfig();
  if (!config.configured || !config.token || !config.workspaceId) {
    return { ok: false, error: "Planable is not configured." };
  }
  try {
    const res = await fetch(`${PLANABLE_API_BASE_URL}/posts/${postId}`, {
      headers: authHeaders(config.token),
    });
    if (res.status === 404) {
      return { ok: false, notFound: true, error: "Post not found" };
    }
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* ignore */
    }
    if (!res.ok) {
      const err = (json as { error?: { message?: string } } | null)?.error
        ?.message;
      return {
        ok: false,
        error: err || `Planable get ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    const raw = extractPostFromResponse(json);
    if (!raw?.id) {
      return { ok: false, notFound: true, error: "Post not found" };
    }
    const pagesById = await fetchPlanablePages(
      config.token,
      config.workspaceId
    );
    return { ok: true, post: toRawPost(raw, pagesById) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Planable get failed",
    };
  }
}

/** Archive (preferred) or delete a Planable post — unpublished only for hard deletes. */
export async function archivePlanablePost(
  postId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = getPlanableConfig();
  if (!config.configured || !config.token) {
    return { ok: false, error: "Planable is not configured." };
  }

  try {
    const patchRes = await fetch(`${PLANABLE_API_BASE_URL}/posts/${postId}`, {
      method: "PATCH",
      headers: authHeaders(config.token, true),
      body: JSON.stringify({ archived: true }),
    });
    if (patchRes.ok || patchRes.status === 404) {
      return { ok: true };
    }

    const delRes = await fetch(`${PLANABLE_API_BASE_URL}/posts/${postId}`, {
      method: "DELETE",
      headers: authHeaders(config.token),
    });
    if (delRes.ok || delRes.status === 404) {
      return { ok: true };
    }

    const text = await delRes.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* ignore */
    }
    const err = (json as { error?: { message?: string } } | null)?.error
      ?.message;
    return {
      ok: false,
      error: err || `Planable archive/delete ${delRes.status}`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Planable archive failed",
    };
  }
}

/** Upload media from a public URL into the Planable workspace. */
export async function uploadPlanableMediaFromUrl(
  url: string
): Promise<{ ok: true; mediaUrl: string } | { ok: false; error: string }> {
  const config = getPlanableConfig();
  if (!config.configured || !config.token || !config.workspaceId) {
    return { ok: false, error: "Planable is not configured." };
  }

  const attempts: Array<{ path: string; body: Record<string, unknown> }> = [
    {
      path: `/media`,
      body: { workspaceId: config.workspaceId, url },
    },
    {
      path: `/workspaces/${config.workspaceId}/media`,
      body: { url },
    },
    {
      path: `/media/from-url`,
      body: { workspaceId: config.workspaceId, url },
    },
  ];

  let lastError = "Media upload not supported";
  for (const attempt of attempts) {
    try {
      const res = await fetch(`${PLANABLE_API_BASE_URL}${attempt.path}`, {
        method: "POST",
        headers: authHeaders(config.token, true),
        body: JSON.stringify(attempt.body),
      });
      const text = await res.text();
      let json: unknown = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* ignore */
      }
      if (!res.ok) {
        const err = (json as { error?: { message?: string } } | null)?.error
          ?.message;
        lastError = err || `Planable media ${res.status}`;
        continue;
      }
      const raw = extractPostFromResponse(json) ?? (json as Record<string, unknown>);
      const mediaUrl =
        (raw?.url as string | undefined) ||
        (raw?.mediaUrl as string | undefined) ||
        (typeof raw?.data === "string" ? raw.data : undefined) ||
        url;
      return { ok: true, mediaUrl: String(mediaUrl) };
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Media upload failed";
    }
  }
  return { ok: false, error: lastError };
}

export function hubStatusFromPlanable(post: {
  published: boolean;
  approved: boolean;
  scheduledAt: string | null;
  scheduledSet?: boolean;
}): ContentStatus {
  if (post.published) return "published";
  // Planable drafts often include a date with scheduledSet=false — stay Draft.
  // Scheduled in the Hub only when approved AND actually scheduled.
  if (post.approved && post.scheduledSet === true) return "scheduled";
  if (post.approved) return "review";
  return "draft";
}

export function scheduledAtFromDueDate(
  dueDate: string | null | undefined
): string | null {
  if (!dueDate) return null;
  const day = dueDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return `${day}T09:00:00.000Z`;
}

export function dueDateFromScheduledAt(
  scheduledAt: string | null | undefined
): string | null {
  if (!scheduledAt) return null;
  const day = scheduledAt.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

export function planableDeepLink(
  postId: string,
  config = getPlanableConfig()
): string {
  if (!config.workspaceId) return config.openUrl;
  return `${config.appUrl}/w/${config.workspaceId}?postId=${encodeURIComponent(postId)}`;
}
