/** Extra people who can see Budget even if they are not Hub admins. */
export const BUDGET_ACCESS_EMAILS = [
  "simon@petersandmay.com",
  "sjudson@petersandmay.com",
  "tom.derbyshire@petersandmay.com",
  "michael.wood@petersandmay.com",
] as const;

const ALLOWLIST = new Set(
  BUDGET_ACCESS_EMAILS.map((email) => email.toLowerCase())
);

export function normalizeEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

export function isBudgetAllowlistedEmail(email: string | null | undefined) {
  return ALLOWLIST.has(normalizeEmail(email));
}

/** Client-safe check — do not import session/server modules from this file. */
export function canAccessBudget(
  user: { role?: string; email?: string } | null | undefined
) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return isBudgetAllowlistedEmail(user.email);
}
