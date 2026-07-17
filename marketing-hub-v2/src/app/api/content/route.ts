import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireStaff } from "@/lib/api";
import {
  createContent,
  deleteContent,
  listContent,
  updateContent,
} from "@/lib/data/repos";
import { normalizeChannels } from "@/lib/data/normalize";

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;
  return jsonOk({ content: await listContent() });
}

export async function POST(request: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;
  const body = await request.json();
  const action = body.action as string | undefined;

  if (action === "update") {
    const patch = { ...(body.patch ?? {}) } as Record<string, unknown>;
    if (patch.channel !== undefined) {
      patch.channel = normalizeChannels(patch.channel);
    }
    const updated = await updateContent(body.id, patch);
    if (!updated) return jsonError("Not found", 404);
    return jsonOk({ item: updated });
  }

  if (action === "delete") {
    await deleteContent(body.id);
    return jsonOk({ ok: true });
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
    planable_url: body.planable_url ?? "",
    asset_url: body.asset_url ?? "",
    notes: body.notes ?? "",
  });
  return jsonOk({ item }, { status: 201 });
}
