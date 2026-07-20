import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireStaff } from "@/lib/api";
import {
  createTask,
  deleteTask,
  listTasks,
  updateTask,
} from "@/lib/data/repos";

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;
  return jsonOk({ tasks: await listTasks() });
}

export async function POST(request: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;
  try {
    const body = await request.json();
    const action = body.action as string | undefined;

    if (action === "update") {
      const updated = await updateTask(body.id, body.patch ?? {});
      if (!updated) return jsonError("Not found", 404);
      return jsonOk({ item: updated });
    }

    if (action === "delete") {
      await deleteTask(body.id);
      return jsonOk({ ok: true });
    }

    const item = await createTask({
      title: body.title ?? "Untitled task",
      details: body.details ?? "",
      due_date: body.due_date || null,
      category: body.category ?? "",
      status: body.status ?? "todo",
      owner: body.owner ?? "",
    });
    return jsonOk({ item }, { status: 201 });
  } catch (err) {
    console.error("[api/tasks] POST failed", err);
    return jsonError(
      err instanceof Error ? err.message : "Failed to save task",
      500
    );
  }
}
