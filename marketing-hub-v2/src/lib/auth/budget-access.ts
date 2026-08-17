import { NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";

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

export function canAccessBudget(
  user: Pick<SessionUser, "role" | "email"> | null | undefined
) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return isBudgetAllowlistedEmail(user.email);
}

export async function requireBudgetAccess(): Promise<
  | { user: SessionUser; error: null }
  | { user: null; error: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!canAccessBudget(user)) {
    return {
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { user, error: null };
}
