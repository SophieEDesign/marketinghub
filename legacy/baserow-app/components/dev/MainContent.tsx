"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import type { DevModeShellData } from "@/lib/dev-mode-data"

const InterfacePageClient = dynamic(
  () => import("@/components/interface/InterfacePageClient"),
  { ssr: false }
)

interface MainContentProps {
  shellData: DevModeShellData
}

function MainContentInner({ shellData }: MainContentProps) {
  const searchParams = useSearchParams()
  const pageId = searchParams.get("pageId")

  if (!pageId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <p className="text-gray-500 mb-2">Select a page from the sidebar</p>
        <p className="text-sm text-gray-400">
          Or add a page in Settings, then open it from the sidebar.
        </p>
      </div>
    )
  }

  return (
    <InterfacePageClient
      pageId={pageId}
      initialPage={undefined}
      initialData={[]}
      isAdmin={shellData.isAdmin}
    />
  )
}

export default function MainContent({ shellData }: MainContentProps) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[40vh]">
          <LoadingSpinner />
        </div>
      }
    >
      <MainContentInner shellData={shellData} />
    </Suspense>
  )
}
