import { redirect } from "next/navigation";
import { BudgetClient } from "@/components/budget/BudgetClient";
import { canAccessBudget } from "@/lib/auth/budget-access";
import { allowDemoAuth, DEMO_STAFF } from "@/lib/auth/config";
import { getSessionUser } from "@/lib/auth/session";
import { createDefaultBudgetMeta } from "@/lib/budget/2026";
import {
  getBudgetMeta,
  listBudgetLines,
  listBudgetPayments,
} from "@/lib/data/repos";

export const dynamic = "force-dynamic";

export default async function BudgetPage() {
  const user =
    (await getSessionUser()) ?? (allowDemoAuth() ? DEMO_STAFF : null);
  if (!user || !canAccessBudget(user)) {
    redirect("/app");
  }

  const [lines, payments, meta] = await Promise.all([
    listBudgetLines(),
    listBudgetPayments(),
    getBudgetMeta(),
  ]);

  return (
    <BudgetClient
      lines={lines}
      payments={payments}
      meta={meta ?? createDefaultBudgetMeta()}
    />
  );
}
