"use client"

import { useCallback, useEffect, useMemo } from "react"
import { useSidebarEditMode, useBlockEditMode, usePageEditMode } from "@/contexts/EditModeContext"
import { useUIMode } from "@/contexts/UIModeContext"

/**
 * Unified workspace edit: sidebar organise + page layout (blocks, builder toolbar, settings panel).
 * One user-facing "Edit" experience; internal scopes stay separate but enter/exit together.
 */
export function useWorkspaceLayoutEdit(pageId?: string) {
  const { isEditing: isSidebarEditing, enter: enterSidebar, exit: exitSidebar } =
    useSidebarEditMode()
  const { isEditing: isBlockEditing, enter: enterBlock, exit: exitBlock } =
    useBlockEditMode(pageId)
  const { isEditing: isPageEditing, exit: exitPage } = usePageEditMode(pageId)
  const { enterEditPages, exitEditPages, isEdit: isUiEdit } = useUIMode()

  const isLayoutEditing = useMemo(
    () =>
      (!!pageId && isUiEdit(pageId)) ||
      isBlockEditing ||
      isPageEditing,
    [pageId, isUiEdit, isBlockEditing, isPageEditing]
  )

  /** True when any part of the unified edit experience is active. */
  const isWorkspaceEditing = isSidebarEditing || isLayoutEditing

  const enter = useCallback(() => {
    enterSidebar()
    if (pageId) {
      enterBlock()
      enterEditPages(pageId)
    }
  }, [pageId, enterSidebar, enterBlock, enterEditPages])

  const exit = useCallback(() => {
    exitSidebar()
    exitBlock()
    exitPage()
    exitEditPages()
  }, [exitSidebar, exitBlock, exitPage, exitEditPages])

  const toggle = useCallback(() => {
    if (isWorkspaceEditing) exit()
    else enter()
  }, [isWorkspaceEditing, enter, exit])

  // Heal split state (e.g. sidebar persisted from localStorage without layout edit).
  useEffect(() => {
    if (!pageId || !isSidebarEditing || isLayoutEditing) return
    enterBlock()
    enterEditPages(pageId)
  }, [pageId, isSidebarEditing, isLayoutEditing, enterBlock, enterEditPages])

  return useMemo(
    () => ({
      isLayoutEditing,
      isWorkspaceEditing,
      isSidebarEditing,
      enter,
      exit,
      toggle,
    }),
    [isLayoutEditing, isWorkspaceEditing, isSidebarEditing, enter, exit, toggle]
  )
}
