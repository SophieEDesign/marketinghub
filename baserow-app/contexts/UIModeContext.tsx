"use client"

import { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from "react"

/**
 * UI modes (Airtable-style):
 * - view: Browse content. Read-only unless opening a record/modal.
 * - edit: Generic edit (legacy alias for editPages).
 * - editPages: Edit page layout (drag-and-drop blocks).
 * - recordLayoutEdit: Edit record modal/drawer layout.
 * - fieldSchemaEdit: Edit field settings in drawer.
 */
export type UIMode = "view" | "edit" | "editPages" | "recordLayoutEdit" | "fieldSchemaEdit"

export interface UIModeState {
  uiMode: UIMode
  /** When in editPages, which page is being edited (if any). */
  editingPageId: string | null
}

interface UIModeContextType {
  state: UIModeState
  uiMode: UIMode
  setUIMode: (mode: UIMode) => void
  /** Enter edit mode (pages, modals, settings, grid). */
  enterEdit: (pageId?: string) => void
  /** Exit edit mode. */
  exitEdit: () => void
  /** True when in any edit mode and (optional) editingPageId matches. */
  isEdit: (pageId?: string) => boolean
  /** Legacy: Enter page layout edit. */
  enterEditPages: (pageId?: string) => void
  /** Legacy: Exit page layout edit. */
  exitEditPages: () => void
  /** Legacy: Enter record layout edit. */
  enterRecordLayoutEdit: () => void
  /** Legacy: Exit record layout edit. */
  exitRecordLayoutEdit: () => void
  /** Legacy: Enter field schema edit. */
  enterFieldSchemaEdit: () => void
  /** Legacy: Exit field schema edit. */
  exitFieldSchemaEdit: () => void
}

const UIModeContext = createContext<UIModeContextType | undefined>(undefined)

interface UIModeProviderProps {
  children: ReactNode
}

export function UIModeProvider({ children }: UIModeProviderProps) {
  // #region agent log
  useEffect(() => {
  }, [])
  // #endregion
  const [state, setState] = useState<UIModeState>({
    uiMode: "view",
    editingPageId: null,
  })

  const isEditing = (mode: UIMode) =>
    mode === "edit" || mode === "editPages" || mode === "recordLayoutEdit" || mode === "fieldSchemaEdit"

  const setUIMode = useCallback((mode: UIMode) => {
    setState((prev) => ({
      uiMode: mode,
      editingPageId: mode === "editPages" || mode === "edit" ? prev.editingPageId : null,
    }))
  }, [])

  const enterEdit = useCallback((pageId?: string) => {
    setState((prev) => ({
      uiMode: "editPages",
      editingPageId: pageId ?? prev.editingPageId ?? null,
    }))
  }, [])

  const exitEdit = useCallback(() => {
    setState(() => ({
      uiMode: "view",
      editingPageId: null,
    }))
  }, [])

  const enterEditPages = useCallback((pageId?: string) => {
    setState((prev) => ({
      uiMode: "editPages",
      editingPageId: pageId ?? prev.editingPageId ?? null,
    }))
  }, [])

  const exitEditPages = exitEdit

  const enterRecordLayoutEdit = useCallback(() => {
    setState(() => ({ uiMode: "recordLayoutEdit", editingPageId: null }))
  }, [])

  const exitRecordLayoutEdit = exitEdit

  const enterFieldSchemaEdit = useCallback(() => {
    setState(() => ({ uiMode: "fieldSchemaEdit", editingPageId: null }))
  }, [])

  const exitFieldSchemaEdit = exitEdit

  const isEdit = useCallback(
    (pageId?: string) => {
      if (!isEditing(state.uiMode)) return false
      if (pageId == null) return true
      return state.uiMode === "editPages" && state.editingPageId === pageId
    },
    [state.uiMode, state.editingPageId]
  )

  const value = useMemo(
    () => ({
      state,
      uiMode: state.uiMode,
      setUIMode,
      enterEdit,
      exitEdit,
      isEdit,
      enterEditPages,
      exitEditPages,
      enterRecordLayoutEdit,
      exitRecordLayoutEdit,
      enterFieldSchemaEdit,
      exitFieldSchemaEdit,
    }),
    [
      state,
      setUIMode,
      enterEdit,
      exitEdit,
      isEdit,
      enterEditPages,
      enterRecordLayoutEdit,
      enterFieldSchemaEdit,
    ]
  )

  return (
    <UIModeContext.Provider value={value}>
      {children}
    </UIModeContext.Provider>
  )
}

export function useUIMode() {
  const context = useContext(UIModeContext)
  if (context === undefined) {
    throw new Error("useUIMode must be used within a UIModeProvider")
  }
  return context
}
