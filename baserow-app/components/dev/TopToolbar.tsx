"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useUIState, UIMODE_LABELS } from "@/contexts/UIStateContext"
import { useEditMode } from "@/contexts/EditModeContext"
import { Button } from "@/components/ui/button"
import { Edit2, Check } from "lucide-react"
import { cn } from "@/lib/utils"

export default function TopToolbar() {
  const searchParams = useSearchParams()
  const pageId = searchParams.get("pageId")
  const { uiMode, setUIMode } = useUIState()
  const { enterEditMode, exitAllEditModes } = useEditMode()

  const badgeLabel = uiMode !== "view" ? UIMODE_LABELS[uiMode] : null

  useEffect(() => {
    if (uiMode === "editPages" && pageId) {
      enterEditMode("sidebar")
      enterEditMode("page", { pageId })
      enterEditMode("block", { pageId })
    } else {
      exitAllEditModes()
    }
  }, [uiMode, pageId, enterEditMode, exitAllEditModes])

  const handleEditPages = () => {
    setUIMode("editPages")
  }

  const handleDone = () => {
    setUIMode("view")
  }

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-gray-900">
          Airtable Dev Mode
        </h1>
        {badgeLabel && (
          <span
            className={cn(
              "px-2 py-0.5 text-xs font-medium rounded-full",
              "bg-amber-100 text-amber-800 border border-amber-200"
            )}
          >
            {badgeLabel}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {uiMode === "view" && pageId && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleEditPages}
            className="gap-1.5"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Edit Pages
          </Button>
        )}
        {uiMode !== "view" && (
          <Button
            variant="default"
            size="sm"
            onClick={handleDone}
            className="gap-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            Done
          </Button>
        )}
      </div>
    </div>
  )
}
