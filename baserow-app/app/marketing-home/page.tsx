import { redirect } from "next/navigation"
import { getAllInterfacePages } from "@/lib/interface/pages"

function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

export default async function MarketingHomePage() {
  const pages = await getAllInterfacePages()

  const exactMarketingHome = pages.find((p) => normalizeName(p.name) === "marketing home")
  if (exactMarketingHome) {
    redirect(`/pages/${exactMarketingHome.id}`)
  }

  const marketingDashboardByStyle = pages.find(
    (p) =>
      (p.config as { layout_style?: string } | undefined)?.layout_style === "marketing_dashboard"
  )
  if (marketingDashboardByStyle) {
    redirect(`/pages/${marketingDashboardByStyle.id}`)
  }

  const namedMarketingDashboard = pages.find((p) => normalizeName(p.name) === "marketing dashboard")
  if (namedMarketingDashboard) {
    redirect(`/pages/${namedMarketingDashboard.id}`)
  }

  redirect("/")
}
