import { redirect } from "next/navigation"

/**
 * Legacy /interface/[pageId] route - redirect to canonical /pages/[pageId].
 * Only /pages/[pageId] renders InterfacePageClient.
 */
export default async function InterfacePage({
  params,
}: {
  params: Promise<{ pageId: string }>
}) {
  const { pageId } = await params
  redirect(`/pages/${pageId}`)
}
