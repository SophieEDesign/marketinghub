export const PLANABLE_API_BASE_URL = "https://api.planable.io/api/v1";

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

function pickMediaUrl(p: Record<string, unknown>): string | null {
  const media = p.media as
    | Array<{ url?: string; thumbnailUrl?: string; type?: string }>
    | undefined;
  if (Array.isArray(media) && media[0]) {
    return media[0].thumbnailUrl || media[0].url || null;
  }
  const attachments = p.attachments as
    | Array<{ url?: string; thumbnail?: string }>
    | undefined;
  if (Array.isArray(attachments) && attachments[0]) {
    return attachments[0].thumbnail || attachments[0].url || null;
  }
  const thumb =
    (p.thumbnailUrl as string | undefined) ||
    (p.thumbnail as string | undefined) ||
    (p.imageUrl as string | undefined) ||
    (p.coverUrl as string | undefined);
  return thumb || null;
}

function pickPlatforms(p: Record<string, unknown>): string[] {
  const pages = p.pages as Array<{ name?: string; type?: string }> | undefined;
  if (Array.isArray(pages) && pages.length) {
    return pages
      .map((x) => x.name || x.type || "")
      .filter(Boolean)
      .map(String);
  }
  const pageName =
    (p.pageName as string | undefined) ||
    (p.page as { name?: string } | undefined)?.name;
  return pageName ? [pageName] : [];
}

export async function fetchPlanablePosts(): Promise<{
  configured: boolean;
  posts: PlanablePost[];
  openUrl: string;
  error?: string;
}> {
  const config = getPlanableConfig();
  if (!config.configured || !config.token || !config.workspaceId) {
    return {
      configured: false,
      posts: [],
      openUrl: config.openUrl,
      error: "Set PLANABLE_API_TOKEN and PLANABLE_WORKSPACE_ID to sync posts.",
    };
  }

  try {
    const res = await fetch(
      `${PLANABLE_API_BASE_URL}/workspaces/${config.workspaceId}/posts?limit=50`,
      {
        headers: {
          Authorization: `Bearer ${config.token}`,
          Accept: "application/json",
        },
        next: { revalidate: 120 },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return {
        configured: true,
        posts: [],
        openUrl: config.openUrl,
        error: `Planable API ${res.status}: ${text.slice(0, 200)}`,
      };
    }

    const data = (await res.json()) as {
      data?: Array<Record<string, unknown>>;
      posts?: Array<Record<string, unknown>>;
    };
    const raw = data.data ?? data.posts ?? [];

    const posts: PlanablePost[] = raw.map((p) => {
      const id = String(p.id ?? p._id ?? crypto.randomUUID());
      const scheduled =
        (p.scheduledAt as string | undefined) ||
        (p.scheduled_at as string | undefined) ||
        (p.publishAt as string | undefined) ||
        null;
      const platforms = pickPlatforms(p);
      return {
        id,
        text: String(p.text ?? p.caption ?? p.title ?? "Untitled post").slice(
          0,
          280
        ),
        status: String(p.status ?? p.state ?? "unknown"),
        scheduledAt: scheduled,
        url: (p.url as string | undefined) ?? null,
        pageName: platforms[0] ?? null,
        mediaUrl: pickMediaUrl(p),
        platforms,
      };
    });

    return { configured: true, posts, openUrl: config.openUrl };
  } catch (e) {
    return {
      configured: true,
      posts: [],
      openUrl: config.openUrl,
      error: e instanceof Error ? e.message : "Planable fetch failed",
    };
  }
}
