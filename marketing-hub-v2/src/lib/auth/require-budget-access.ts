import { NextResponse } from "next/server";
import { canAccessBudget } from "@/lib/auth/budget-access";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";

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
