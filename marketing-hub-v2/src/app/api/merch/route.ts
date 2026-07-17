import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireStaff } from "@/lib/api";
import {
  createMerchOrder,
  deleteMerchOrder,
  getMerchOrder,
  listMerchOrders,
  updateMerchOrder,
} from "@/lib/data/repos";
import {
  filterMerchOrdersForUser,
  isMerchAdmin,
  ownsMerchOrder,
} from "@/lib/merch/access";
import {
  DEFAULT_CLOTHING_LOGO,
  isClothingLogo,
} from "@/lib/merch/north-sails";

export async function GET() {
  const { user, error } = await requireStaff();
  if (error) return error;
  const orders = filterMerchOrdersForUser(await listMerchOrders(), user);
  return jsonOk({ orders, canManageAll: isMerchAdmin(user) });
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireStaff();
  if (error) return error;
  const body = await request.json();
  const action = body.action as string | undefined;
  const admin = isMerchAdmin(user);

  if (action === "update") {
    const existing = await getMerchOrder(body.id);
    if (!existing) return jsonError("Not found", 404);
    if (!admin && !ownsMerchOrder(existing, user)) {
      return jsonError("Forbidden", 403);
    }
    const patch = { ...(body.patch ?? {}) } as Record<string, unknown>;
    // Members cannot reassign ownership or escalate status beyond cancel.
    delete patch.created_by_user_id;
    if (!admin) {
      delete patch.created_by;
      if (
        patch.status !== undefined &&
        patch.status !== existing.status &&
        patch.status !== "cancelled" &&
        patch.status !== "requested"
      ) {
        return jsonError("Only marketing admins can change order status", 403);
      }
    }
    const updated = await updateMerchOrder(body.id, patch);
    if (!updated) return jsonError("Not found", 404);
    return jsonOk({ item: updated });
  }

  if (action === "delete") {
    const existing = await getMerchOrder(body.id);
    if (!existing) return jsonError("Not found", 404);
    if (!admin && !ownsMerchOrder(existing, user)) {
      return jsonError("Forbidden", 403);
    }
    try {
      await deleteMerchOrder(body.id);
    } catch (err) {
      console.error("[merch] delete failed", err);
      return jsonError("Could not delete order", 500);
    }
    return jsonOk({ ok: true });
  }

  const item = await createMerchOrder({
    item: body.item ?? "Polo — Regatta (polyester)",
    fit: body.fit === "female" || body.fit === "male" ? body.fit : "",
    size: body.size ?? "",
    quantity: Number(body.quantity) > 0 ? Number(body.quantity) : 1,
    colour: body.colour ?? "",
    logo: isClothingLogo(body.logo) ? body.logo : DEFAULT_CLOTHING_LOGO,
    requested_for:
      body.requested_for?.trim() ||
      user.full_name ||
      user.email ||
      "Staff",
    office: body.office ?? "",
    needed_by: body.needed_by || null,
    status: admin ? body.status ?? "requested" : "requested",
    notes: body.notes ?? "",
    created_by: user.full_name || user.email || "Staff",
    created_by_user_id: user.id,
  });
  return jsonOk({ item }, { status: 201 });
}
