import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireStaff } from "@/lib/api";
import {
  createReport,
  deleteReport,
  listReports,
  updateReport,
} from "@/lib/data/repos";

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;
  return jsonOk({ reports: await listReports() });
}

export async function POST(request: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;
  const body = await request.json();
  const action = body.action as string | undefined;

  if (action === "update") {
    const updated = await updateReport(body.id, body.patch ?? {});
    if (!updated) return jsonError("Not found", 404);
    return jsonOk({ item: updated });
  }

  if (action === "delete") {
    await deleteReport(body.id);
    return jsonOk({ ok: true });
  }

  const item = await createReport({
    title: body.title ?? "Report",
    description: body.description ?? "",
    url: body.url ?? "",
    category: body.category ?? "Dashboards",
    tool: body.tool ?? "",
  });
  return jsonOk({ item }, { status: 201 });
}
