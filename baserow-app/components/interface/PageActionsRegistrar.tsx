"use client"

/**
 * Registers page actions (Edit/View, Page settings) for the sidebar BaseDropdown.
 * Mounts immediately without Suspense so the Edit option appears as soon as the page loads,
 * before InterfacePageClientInternal (which uses useSearchParams and suspends) mounts.
 */
import { useEffect } from "react"
import { usePageActions } from "@/contexts/PageActionsContext"
import { useEditMode, usePageEditMode, useBlockEditMode } from "@/contexts/EditModeContext"
import { useUIMode } from "@/contexts/UIModeContext"
import { useSelectionContext } from "@/contexts/SelectionContext"

interface PageActionsRegistrarProps {
  pageId: string
  isAdmin: boolean
  isViewer: boolean
}

export default function PageActionsRegistrar({
  pageId,
  isAdmin,
  isViewer,
}: PageActionsRegistrarProps) {
  const { registerPageActions, unregisterPageActions } = usePageActions()
  const { clearEditingContext } = useEditMode()
  const { isEditing: isPageEditing, exit: exitPageEdit } = usePageEditMode(pageId)
  const { isEditing: isBlockEditing, enter: enterBlockEdit, exit: exitBlockEdit } = useBlockEditMode(pageId)
  const { exitEditPages } = useUIMode()
  const { setSelectedContext } = useSelectionContext()

  // DEBUG: Confirm registration runs when pageId changes (remove after confirmation)
  useEffect(() => {
    console.log("[PageActionsRegistrar] Registering page actions for:", pageId)
  }, [pageId])

  useEffect(() => {
    if (!pageId) return

    if (isViewer || !isAdmin) {
      unregisterPageActions()
      return
    }

    registerPageActions({
      onOpenPageSettings: () => setSelectedContext({ type: "page" }),
      onEnterEdit: () => enterBlockEdit(),
      onExitEdit: () => {
        exitPageEdit()
        exitBlockEdit()
        exitEditPages()
      },
      isEditing: isPageEditing || isBlockEditing,
    })

    return () => {
      unregisterPageActions()
      clearEditingContext("block")
    }
  }, [pageId, isAdmin, isViewer, isPageEditing, isBlockEditing, enterBlockEdit, exitPageEdit, exitBlockEdit, exitEditPages, setSelectedContext, registerPageActions, unregisterPageActions, clearEditingContext])

  return null
}
