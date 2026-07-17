import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireStaff } from "@/lib/api";
import {
  createTheme,
  createThemeMain,
  createThemeOffshoot,
  deleteTheme,
  deleteThemeMain,
  deleteThemeOffshoot,
  listThemeMains,
  listThemeOffshoots,
  listThemes,
  updateTheme,
  updateThemeMain,
  updateThemeOffshoot,
} from "@/lib/data/repos";

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;
  const [themes, mains, offshoots] = await Promise.all([
    listThemes(),
    listThemeMains(),
    listThemeOffshoots(),
  ]);
  return jsonOk({ themes, mains, offshoots });
}

export async function POST(request: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;
  const body = await request.json();
  const action = body.action as string | undefined;
  const entity = body.entity as "theme" | "main" | "offshoot" | undefined;

  if (action === "update") {
    if (entity === "theme") {
      const item = await updateTheme(body.id, body.patch ?? {});
      if (!item) return jsonError("Not found", 404);
      return jsonOk({ item });
    }
    if (entity === "main") {
      const item = await updateThemeMain(body.id, body.patch ?? {});
      if (!item) return jsonError("Not found", 404);
      return jsonOk({ item });
    }
    if (entity === "offshoot") {
      const item = await updateThemeOffshoot(body.id, body.patch ?? {});
      if (!item) return jsonError("Not found", 404);
      return jsonOk({ item });
    }
    return jsonError("Unknown entity");
  }

  if (action === "delete") {
    if (entity === "theme") await deleteTheme(body.id);
    else if (entity === "main") await deleteThemeMain(body.id);
    else if (entity === "offshoot") await deleteThemeOffshoot(body.id);
    else return jsonError("Unknown entity");
    return jsonOk({ ok: true });
  }

  if (entity === "main") {
    const item = await createThemeMain({
      theme_id: body.theme_id,
      title: body.title ?? "Main content",
      channel: body.channel ?? "",
      owner: body.owner ?? "",
      status: body.status ?? "idea",
      notes: body.notes ?? "",
    });
    return jsonOk({ item }, { status: 201 });
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
