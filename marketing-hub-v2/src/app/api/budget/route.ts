import { jsonOk, jsonError } from "@/lib/api";
import { requireBudgetAccess } from "@/lib/auth/budget-access";
import { BUDGET_2026 } from "@/lib/budget/2026";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireBudgetAccess();
  if (error) return error;
  return jsonOk({ budget: BUDGET_2026 });
}

export async function POST() {
  const { error } = await requireBudgetAccess();
  if (error) return error;
  return jsonError("Budget is read-only in this draft", 405);
}
