"use client"

/**
 * Registers page actions (Edit/View, Page settings) for the sidebar BaseDropdown.
 * Mounts immediately without Suspense so the Edit option appears as soon as the page loads,
 * before InterfacePageClientInternal (which uses useSearchParams and suspends) mounts.
 */
import { useEffect, useCallback } from "react"
import { usePageActions } from "@/contexts/PageActionsContext"
import { useWorkspaceLayoutEdit } from "@/hooks/useWorkspaceLayoutEdit"
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
  const { isLayoutEditing, enter: enterWorkspaceEdit, exit: exitWorkspaceEdit } =
    useWorkspaceLayoutEdit(pageId)
  const { setSelectedContext } = useSelectionContext()

  const onOpenPageSettings = useCallback(() => {
    setSelectedContext({ type: "page" })
  }, [setSelectedContext])

  const onEnterEdit = useCallback(() => {
    enterWorkspaceEdit()
  }, [enterWorkspaceEdit])

  const onExitEdit = useCallback(() => {
    exitWorkspaceEdit()
  }, [exitWorkspaceEdit])

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
      isEditing: isLayoutEditing,
    })

    return () => {
      unregisterPageActions()
    }
  }, [pageId, isAdmin, isViewer, isLayoutEditing, onOpenPageSettings, onEnterEdit, onExitEdit, registerPageActions, unregisterPageActions])

  return null
}
