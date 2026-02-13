import { redirect } from "next/navigation"
import { isAirtableDevMode } from "@/lib/featureFlags"
import { getDevModeShellData } from "@/lib/dev-mode-data"
import { getWorkspaceSettings } from "@/lib/branding"
import { BrandingProvider } from "@/contexts/BrandingContext"
import AirtableDevModeClient from "@/components/dev/AirtableDevModeClient"

export default async function AirtableDevPage() {
  if (!isAirtableDevMode) {
    redirect("/")
  }

  const [shellData, brandingSettings] = await Promise.all([
    getDevModeShellData(),
    getWorkspaceSettings().catch(() => null),
  ])

  if (!shellData) {
    redirect("/login")
  }

  return (
    <BrandingProvider settings={brandingSettings}>
      <AirtableDevModeClient shellData={shellData} />
    </BrandingProvider>
  )
}
