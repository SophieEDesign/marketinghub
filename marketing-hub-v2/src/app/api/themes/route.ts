import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireStaff } from "@/lib/api";
import {
  createContent,
  createTheme,
  createThemeMain,
  createThemeOffshoot,
  deleteTheme,
  deleteThemeMain,
  deleteThemeOffshoot,
  ensureThemeMainContentLink,
  listContent,
  listThemeMains,
  listThemeOffshoots,
  listThemes,
  updateContent,
  updateTheme,
  updateThemeMain,
  updateThemeOffshoot,
} from "@/lib/data/repos";

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;
  const [themes, mains, offshoots, content] = await Promise.all([
    listThemes(),
    listThemeMains(),
    listThemeOffshoots(),
    listContent(),
  ]);
  return jsonOk({ themes, mains, offshoots, content });
}

export async function POST(request: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;
  const body = await request.json();
  const action = body.action as string | undefined;
  const entity = body.entity as "theme" | "main" | "offshoot" | undefined;

  if (action === "ensureContent") {
    const linked = await ensureThemeMainContentLink(body.id);
    if (!linked) return jsonError("Not found", 404);
    return jsonOk(linked);
  }

  if (action === "update") {
    if (entity === "theme") {
      const item = await updateTheme(body.id, body.patch ?? {});
      if (!item) return jsonError("Not found", 404);
      return jsonOk({ item });
    }
    if (entity === "main") {
      const item = await updateThemeMain(body.id, body.patch ?? {});
      if (!item) return jsonError("Not found", 404);
      if (item.content_id && body.patch) {
        const sync: Record<string, unknown> = {};
        if (body.patch.title !== undefined) sync.title = body.patch.title;
        if (body.patch.channel !== undefined) sync.channel = body.patch.channel;
        if (body.patch.owner !== undefined) sync.owner = body.patch.owner;
        if (body.patch.status !== undefined) sync.status = body.patch.status;
        if (body.patch.notes !== undefined) sync.notes = body.patch.notes;
        if (Object.keys(sync).length > 0) {
          await updateContent(item.content_id, sync);
        }
      }
      return jsonOk({ item });
    }
    if (entity === "offshoot") {
      const item = await updateThemeOffshoot(body.id, body.patch ?? {});
      if (!item) return jsonError("Not found", 404);
      return jsonOk({ item });
    }
    return jsonError("Unknown entity");
  }

  if (action === "updateContent") {
    const content = await updateContent(body.id, body.patch ?? {});
    if (!content) return jsonError("Not found", 404);
    const mains = await listThemeMains();
    const main = mains.find((m) => m.content_id === content.id);
    if (main) {
      await updateThemeMain(main.id, {
        title: content.title,
        channel: content.channel,
        owner: content.owner,
        status: content.status,
        notes: content.notes,
      });
    }
    return jsonOk({ content, mainId: main?.id ?? null });
  }

  if (action === "delete") {
    if (entity === "theme") await deleteTheme(body.id);
    else if (entity === "main") await deleteThemeMain(body.id);
    else if (entity === "offshoot") await deleteThemeOffshoot(body.id);
    else return jsonError("Unknown entity");
    return jsonOk({ ok: true });
  }

  if (entity === "main") {
    const title = body.title ?? "Main content";
    const channel = body.channel ?? "";
    const owner = body.owner ?? "";
    const status = body.status ?? "idea";
    const notes = body.notes ?? "";
    const content = await createContent({
      title,
      channel: channel || "Editorial",
      content_type: body.content_type ?? "Editorial",
      owner,
      due_date: null,
      status,
      planable_url: "",
      asset_url: "",
      notes,
    });
    const item = await createThemeMain({
      theme_id: body.theme_id,
      content_id: content.id,
      title,
      channel,
      owner,
      status,
      notes,
    });
    return jsonOk({ item, content }, { status: 201 });
  }

  if (entity === "offshoot") {
    const item = await createThemeOffshoot({
      main_content_id: body.main_content_id,
      title: body.title ?? "Offshoot",
      channel: body.channel ?? "",
      owner: body.owner ?? "",
      status: body.status ?? "idea",
      notes: body.notes ?? "",
    });
    return jsonOk({ item }, { status: 201 });
  }

  const item = await createTheme({
    title: body.title ?? "Theme",
    quarter: body.quarter ?? "Q1",
    year: body.year ?? new Date().getFullYear(),
    status: body.status ?? "upcoming",
    summary: body.summary ?? "",
  });
  return jsonOk({ item }, { status: 201 });
}
