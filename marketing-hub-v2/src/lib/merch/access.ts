import type { SessionUser } from "@/lib/auth/session";
import type { MerchOrder } from "@/lib/types";

export function isMerchAdmin(user: SessionUser) {
  return user.role === "admin";
}

/** True when this order belongs to the signed-in user. */
export function ownsMerchOrder(order: MerchOrder, user: SessionUser) {
  if (order.created_by_user_id) {
    return order.created_by_user_id === user.id;
  }
  // Legacy rows (pre user-id): match creator name/email only.
  const needles = [user.full_name, user.email]
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const created = order.created_by.trim().toLowerCase();
  return needles.some((n) => created === n);
}

export function filterMerchOrdersForUser(
  orders: MerchOrder[],
  user: SessionUser
): MerchOrder[] {
  if (isMerchAdmin(user)) return orders;
  return orders.filter((o) => ownsMerchOrder(o, user));
}
