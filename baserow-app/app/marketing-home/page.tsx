import { redirect } from "next/navigation"
import { getAllInterfacePages } from "@/lib/interface/pages"
import { resolveLandingPage } from "@/lib/interfaces"

function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

export default async function MarketingHomePage() {
  const { pageId } = await resolveLandingPage()
  if (pageId) {
    redirect(`/pages/${pageId}`)
  }

  const pages = await getAllInterfacePages()

  const marketingHomeByStyle = pages.find(
    (p) =>
      (p.config as { layout_style?: string } | undefined)?.layout_style === "marketing_home"
  )
  if (marketingHomeByStyle) {
    redirect(`/pages/${marketingHomeByStyle.id}`)
  }

  const dashboardPage = pages.find((p) => normalizeName(p.name) === "dashboard")
  if (dashboardPage) {
    redirect(`/pages/${dashboardPage.id}`)
  }

  const legacyMarketingHome = pages.find((p) => normalizeName(p.name) === "marketing home")
  if (legacyMarketingHome) {
    redirect(`/pages/${legacyMarketingHome.id}`)
  }

  const marketingDashboardByStyle = pages.find(
    (p) =>
      (p.config as { layout_style?: string } | undefined)?.layout_style === "marketing_dashboard" &&
      normalizeName(p.name) === "marketing dashboard"
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
