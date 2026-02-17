"use client"

/**
 * Registers page actions (Edit/View, Page settings) for the sidebar BaseDropdown.
 * Mounts immediately without Suspense so the Edit option appears as soon as the page loads,
 * before InterfacePageClientInternal (which uses useSearchParams and suspends) mounts.
 */
import { useEffect, useCallback } from "react"
import { usePageActions } from "@/contexts/PageActionsContext"
import { usePageEditMode, useBlockEditMode } from "@/contexts/EditModeContext"
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
  const { isEditing: isPageEditing, exit: exitPageEdit } = usePageEditMode(pageId)
  const { isEditing: isBlockEditing, enter: enterBlockEdit, exit: exitBlockEdit } = useBlockEditMode(pageId)
  const { enterEditPages, exitEditPages } = useUIMode()
  const { setSelectedContext } = useSelectionContext()

  const onOpenPageSettings = useCallback(() => {
    setSelectedContext({ type: "page" })
  }, [setSelectedContext])

  const onEnterEdit = useCallback(() => {
    enterBlockEdit()
    enterEditPages(pageId)
  }, [enterBlockEdit, enterEditPages, pageId])

  const onExitEdit = useCallback(() => {
    exitPageEdit()
    exitBlockEdit()
    exitEditPages()
  }, [exitPageEdit, exitBlockEdit, exitEditPages])

  useEffect(() => {
    if (!pageId) return

    if (isViewer || !isAdmin) {
      unregisterPageActions()
      return
    }

    registerPageActions({
      onOpenPageSettings,
      onEnterEdit,
      onExitEdit,
      isEditing: isPageEditing || isBlockEditing,
    })

    return () => {
      unregisterPageActions()
    }
  }, [pageId, isAdmin, isViewer, isPageEditing, isBlockEditing, onOpenPageSettings, onEnterEdit, onExitEdit, registerPageActions, unregisterPageActions])

  return null
}
