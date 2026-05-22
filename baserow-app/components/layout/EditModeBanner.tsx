"use client"

/**
 * Airtable-style edit mode banner - a prominent top toolbar shown when editing.
 * Makes edit mode unmistakably obvious across the app.
 */
import { usePathname } from "next/navigation"
import { useEditMode, useBlockEditMode } from "@/contexts/EditModeContext"
import { useUIMode } from "@/contexts/UIModeContext"
import { Button } from "@/components/ui/button"
import { Check, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"

export default function EditModeBanner() {
  const { isEditing, exitAllEditModes } = useEditMode()
  const { exitEditPages, isEdit } = useUIMode()
  const pathname = usePathname()
  const pageId = pathname?.match(/\/pages\/([^/?]+)/)?.[1]
  const { isEditing: isBlockEditingOnPage } = useBlockEditMode(pageId)

  const isPageLayoutEditing =
    isEdit(pageId) ||
    isBlockEditingOnPage ||
    isEditing("page")

  const handleDone = () => {
    exitAllEditModes()
    exitEditPages()
  }

  // Sidebar "Organise" is not page layout edit — do not show this banner (avoids false "Editing" state).
  if (!isPageLayoutEditing) return null

  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 sm:px-6 h-12 shrink-0",
        "bg-amber-50 border-b border-amber-200",
        "text-amber-900"
      )}
      role="banner"
      aria-label="Edit mode active"
    >
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-amber-200/80">
          <Pencil className="h-3.5 w-3.5 text-amber-800" aria-hidden />
        </div>
        <span className="font-medium text-sm">
          Editing
        </span>
      </div>
      <Button
        variant="default"
        size="sm"
        onClick={handleDone}
        className={cn(
          "gap-1.5 font-medium",
          "bg-amber-600 hover:bg-amber-700 text-white",
          "border-amber-700/30"
        )}
      >
        <Check className="h-3.5 w-3.5" />
        Done
      </Button>
    </div>
  )
}
