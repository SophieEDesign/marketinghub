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
  if (!pageId) {
    redirect("/")
  }
  redirect(`/pages/${pageId}`)
}
