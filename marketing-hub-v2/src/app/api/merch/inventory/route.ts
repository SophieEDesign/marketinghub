import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireStaff } from "@/lib/api";
import {
  createMerchInventoryItem,
  deleteMerchInventoryItem,
  listMerchInventory,
  updateMerchInventoryItem,
} from "@/lib/data/repos";
import { defaultBrandForItem, defaultColourForItem } from "@/lib/merch/north-sails";

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;
  return jsonOk({ items: await listMerchInventory() });
}

export async function POST(request: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;
  const body = await request.json();
  const action = body.action as string | undefined;

  if (action === "update") {
    const patch = { ...(body.patch ?? {}) } as Record<string, unknown>;
    if ("quantity" in patch) {
      const q = Number(patch.quantity);
      patch.quantity = Number.isFinite(q) && q >= 0 ? Math.floor(q) : 0;
    }
    const updated = await updateMerchInventoryItem(body.id, patch);
    if (!updated) return jsonError("Not found", 404);
    return jsonOk({ item: updated });
  }

  if (action === "delete") {
    await deleteMerchInventoryItem(body.id);
    return jsonOk({ ok: true });
  }

  const itemLabel = String(body.item ?? "Polo — Regatta (polyester)").trim();
  const item = await createMerchInventoryItem({
    item: itemLabel || "Polo — Regatta (polyester)",
    brand: body.brand || defaultBrandForItem(itemLabel),
    fit: body.fit === "female" || body.fit === "male" ? body.fit : "",
    size: body.size ?? "M",
    colour: body.colour || defaultColourForItem(itemLabel),
    quantity: Number(body.quantity) >= 0 ? Math.floor(Number(body.quantity)) : 0,
    image_url: typeof body.image_url === "string" ? body.image_url : "",
    notes: body.notes ?? "",
  });
  return jsonOk({ item }, { status: 201 });
}
