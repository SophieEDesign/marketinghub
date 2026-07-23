import type { SessionUser } from "@/lib/auth/session";
import type { Sponsorship } from "@/lib/types";

export function isPartnersAdmin(user: SessionUser) {
  return user.role === "admin";
}

/** True when this partner record was added by the signed-in user. */
export function ownsPartnerRecord(item: Sponsorship, user: SessionUser) {
  if (item.created_by_user_id) {
    return item.created_by_user_id === user.id;
  }
  // Legacy rows (pre user-id): match creator name/email.
  const needles = [user.full_name, user.email]
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const created = (item.created_by ?? "").trim().toLowerCase();
  if (!created) return false;
  return needles.some((n) => {
    if (created === n) return true;
    const first = n.split(/\s+/)[0];
    return Boolean(first && created === first);
  });
}

/** Members may edit memberships they added; admins may edit anything. */
export function canManagePartnerRecord(
  item: Sponsorship,
  user: SessionUser
): boolean {
  if (isPartnersAdmin(user)) return true;
  if (item.kind !== "membership") return false;
  return ownsPartnerRecord(item, user);
}
