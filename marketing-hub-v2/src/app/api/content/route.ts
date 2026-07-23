import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireAdmin, requireStaff } from "@/lib/api";
import {
  createContent,
  deleteContent,
  listContent,
  updateContent,
  withContentPlanableDefaults,
} from "@/lib/data/repos";
import {
  isSocialContentItem,
  normalizeChannels,
} from "@/lib/data/normalize";
import { pushContentToPlanable, removeContentFromPlanable } from "@/lib/planable/sync";
import type { ContentItem } from "@/lib/types";

async function maybePushPlanable(
  item: ContentItem
): Promise<{ item: ContentItem; planableSyncError?: string }> {
  if (!isSocialContentItem(item)) {
    return { item };
  }
  if (item.status === "published") {
    return { item };
  }
  const result = await pushContentToPlanable(item);
  return {
    item: result.item,
    ...(result.error ? { planableSyncError: result.error } : {}),
  };
}

/** Members only see scheduled/published social — not drafts/pipeline. */
function contentVisibleToMember(items: ContentItem[]): ContentItem[] {
  return items.filter(
    (c) =>
      isSocialContentItem(c) &&
      (c.status === "scheduled" || c.status === "published")
  );
}

export async function GET() {
  const { user, error } = await requireStaff();
  if (error) return error;
  const content = await listContent();
  if (user.role !== "admin") {
    return jsonOk({ content: contentVisibleToMember(content) });
  }
  return jsonOk({ content });
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const body = await request.json();
  const action = body.action as string | undefined;

  if (action === "update") {
    const existingList = await listContent();
    const existing = existingList.find((c) => c.id === body.id);
    if (!existing) return jsonError("Not found", 404);

    if (existing.status === "published") {
      return jsonError(
        "This post is published and locked in the Hub. You can only delete it.",
        403
      );
    }

    const patch = { ...(body.patch ?? {}) } as Record<string, unknown>;
    if (patch.status === "published") {
      return jsonError(
        "Publish only in Planable. Sync from Planable to mark it published in the Hub.",
        403
      );
    }
    if (patch.channel !== undefined) {
      patch.channel = normalizeChannels(patch.channel);
    }
    // User edits mark hub as source before push
    if (isSocialContentItem({ ...existing, ...patch } as ContentItem)) {
      patch.sync_source = "hub";
    }

    const updated = await updateContent(body.id, patch);
    if (!updated) return jsonError("Not found", 404);

    const pushed = await maybePushPlanable(withContentPlanableDefaults(updated));
    return jsonOk({
      item: pushed.item,
      ...(pushed.planableSyncError
        ? { planableSyncError: pushed.planableSyncError }
        : {}),
    });
  }

  if (action === "delete") {
    const existingList = await listContent();
    const existing = existingList.find((c) => c.id === body.id);
    if (existing) {
      const planable = await removeContentFromPlanable(
        withContentPlanableDefaults(existing)
      );
      await deleteContent(body.id);
      return jsonOk({
        ok: true,
        ...(planable.error ? { planableSyncError: planable.error } : {}),
      });
    }
    await deleteContent(body.id);
    return jsonOk({ ok: true });
  }

  if (body.status === "published") {
    return jsonError(
      "Publish only in Planable. Create as draft/scheduled in the Hub.",
      403
    );
  }

  const item = await createContent({
    title: body.title ?? "Untitled",
    channel: normalizeChannels(body.channel ?? body.channels ?? ["LinkedIn"]),
    content_type: body.content_type ?? "Social",
    owner: body.owner ?? "",
    due_date: body.due_date ?? null,
    deadline_date: body.deadline_date ?? null,
    status: body.status ?? "idea",
    category: body.category ?? "",
    priority: body.priority ?? "",
    website: body.website ?? "",
    caption: body.caption ?? "",
    theme_id: body.theme_id || null,
    planable_url: body.planable_url ?? "",
    planable_post_id: body.planable_post_id ?? "",
    planable_group_id: body.planable_group_id ?? "",
    planable_page_ids: Array.isArray(body.planable_page_ids)
      ? body.planable_page_ids.map(String)
      : [],
    last_synced_at: null,
    sync_source: "hub",
    asset_url: body.asset_url ?? "",
    notes: body.notes ?? "",
  });

  const pushed = await maybePushPlanable(withContentPlanableDefaults(item));
  return jsonOk(
    {
      item: pushed.item,
      ...(pushed.planableSyncError
        ? { planableSyncError: pushed.planableSyncError }
        : {}),
    },
    { status: 201 }
  );
}
