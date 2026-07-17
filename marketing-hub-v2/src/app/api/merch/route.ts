import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireStaff } from "@/lib/api";
import {
  createMerchOrder,
  deleteMerchOrder,
  listMerchOrders,
  updateMerchOrder,
} from "@/lib/data/repos";

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;
  return jsonOk({ orders: await listMerchOrders() });
}

export async function POST(request: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;
  const body = await request.json();
  const action = body.action as string | undefined;

  if (action === "update") {
    const updated = await updateMerchOrder(body.id, body.patch ?? {});
    if (!updated) return jsonError("Not found", 404);
    return jsonOk({ item: updated });
  }

  if (action === "delete") {
    await deleteMerchOrder(body.id);
    return jsonOk({ ok: true });
  }

  const item = await createMerchOrder({
    item: body.item ?? "Polo — Regatta (polyester)",
    fit: body.fit === "female" || body.fit === "male" ? body.fit : "",
    size: body.size ?? "",
    quantity: Number(body.quantity) > 0 ? Number(body.quantity) : 1,
    colour: body.colour ?? "",
    requested_for: body.requested_for ?? "",
    office: body.office ?? "",
    needed_by: body.needed_by || null,
    status: body.status ?? "requested",
    notes: body.notes ?? "",
    created_by: body.created_by ?? "Staff",
  });
  return jsonOk({ item }, { status: 201 });
}
