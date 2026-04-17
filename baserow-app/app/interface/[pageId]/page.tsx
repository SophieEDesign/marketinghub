import { redirect } from "next/navigation"

/**
 * Legacy /interface/[pageId] route - redirect to canonical /pages/[pageId].
 * Only /pages/[pageId] renders InterfacePageClient.
 */
export default async function InterfacePage({
  params,
}: {
  params: { pageId: string } | Promise<{ pageId: string }>
}) {
  const resolvedParams = await params
  const pageId = typeof resolvedParams?.pageId === "string" ? resolvedParams.pageId : null
  // #region agent log
  console.error("[agent-debug]", {
    sessionId: "909a6f",
    runId: "initial",
    hypothesisId: "H15",
    location: "app/interface/[pageId]/page.tsx:redirect",
    message: "Legacy interface route redirect evaluated",
    data: { hasPageId: Boolean(pageId), pageIdType: typeof resolvedParams?.pageId },
    timestamp: Date.now(),
  })
  // #endregion
  if (!pageId) {
    redirect("/")
  }
  redirect(`/pages/${pageId}`)
}
