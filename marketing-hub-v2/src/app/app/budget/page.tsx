import { redirect } from "next/navigation";
import { BudgetClient } from "@/components/budget/BudgetClient";
import { canAccessBudget } from "@/lib/auth/budget-access";
import { allowDemoAuth, DEMO_STAFF } from "@/lib/auth/config";
import { getSessionUser } from "@/lib/auth/session";
import { BUDGET_2026 } from "@/lib/budget/2026";

export const dynamic = "force-dynamic";

export default async function BudgetPage() {
  const user =
    (await getSessionUser()) ?? (allowDemoAuth() ? DEMO_STAFF : null);
  if (!user || !canAccessBudget(user)) {
    redirect("/app");
  }

  return <BudgetClient data={BUDGET_2026} />;
}
