import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireStaff } from "@/lib/api";
import {
  addField,
  addRow,
  bulkDelete,
  bulkUpdate,
  deleteRow,
  getTable,
  listCollectionSummaries,
  removeField,
  updateCell,
} from "@/lib/data/data-admin";

export async function GET(request: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;

  const collection = request.nextUrl.searchParams.get("collection");
  if (!collection) {
    return jsonOk({ collections: listCollectionSummaries() });
  }

  try {
    return jsonOk(await getTable(collection));
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 400);
  }
}

export async function POST(request: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;

  const body = await request.json();
  const action = body.action as string;

  try {
    if (action === "updateCell") {
      const row = await updateCell(
        body.collection,
        body.id,
        body.field,
        body.value
      );
      return jsonOk({ row });
    }
    if (action === "bulkUpdate") {
      const result = await bulkUpdate(
        body.collection,
        Array.isArray(body.ids) ? body.ids : [],
        body.field,
        body.value
      );
      return jsonOk(result);
    }
    if (action === "bulkDelete") {
      const result = await bulkDelete(
        body.collection,
        Array.isArray(body.ids) ? body.ids : []
      );
      return jsonOk(result);
    }
    if (action === "addRow") {
      const row = await addRow(body.collection, body.patch ?? {});
      return jsonOk({ row }, { status: 201 });
    }
    if (action === "deleteRow") {
      await deleteRow(body.collection, body.id);
      return jsonOk({ ok: true });
    }
    if (action === "addField") {
      const field = await addField(body.collection, body.name);
      return jsonOk({ field }, { status: 201 });
    }
    if (action === "removeField") {
      await removeField(body.collection, body.name);
      return jsonOk({ ok: true });
    }
    return jsonError("Unknown action");
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 400);
  }
}
