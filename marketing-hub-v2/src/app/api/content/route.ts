import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireStaff } from "@/lib/api";
import {
  createContent,
  deleteContent,
  listContent,
  updateContent,
} from "@/lib/data/repos";

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
    const updated = await updateContent(body.id, body.patch ?? {});
    if (!updated) return jsonError("Not found", 404);
    return jsonOk({ item: updated });
  }

  if (action === "delete") {
    await deleteContent(body.id);
    return jsonOk({ ok: true });
  }

  const item = await createContent({
    title: body.title ?? "Untitled",
    channel: body.channel ?? "General",
    content_type: body.content_type ?? "Social",
    owner: body.owner ?? "",
    due_date: body.due_date ?? null,
    status: body.status ?? "idea",
    planable_url: body.planable_url ?? "",
    asset_url: body.asset_url ?? "",
    notes: body.notes ?? "",
  });
  return jsonOk({ item }, { status: 201 });
}
