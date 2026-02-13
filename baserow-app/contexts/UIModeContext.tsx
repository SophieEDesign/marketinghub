"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"

/**
 * Two modes only (Airtable-style):
 * - view: Browse content. Read-only unless opening a record/modal.
 * - edit: Edit page layout (drag-and-drop blocks), edit record modals (layout),
 *   settings on right panel, grid editor. One "Edit" in toolbar to enter, "Done" to exit.
 */
export type UIMode = "view" | "edit"

export interface UIModeState {
  uiMode: UIMode
  /** When in edit, which page is being edited (if any). */
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
  /** True when uiMode === 'edit' and (optional) editingPageId matches. */
  isEdit: (pageId?: string) => boolean
}

const UIModeContext = createContext<UIModeContextType | undefined>(undefined)

interface UIModeProviderProps {
  children: ReactNode
}

export function UIModeProvider({ children }: UIModeProviderProps) {
  const [state, setState] = useState<UIModeState>({
    uiMode: "view",
    editingPageId: null,
  })

  const setUIMode = useCallback((mode: UIMode) => {
    setState((prev) => ({
      uiMode: mode,
      editingPageId: mode === "edit" ? prev.editingPageId : null,
    }))
  }, [])

  const enterEdit = useCallback((pageId?: string) => {
    setState((prev) => ({
      uiMode: "edit",
      editingPageId: pageId ?? prev.editingPageId ?? null,
    }))
  }, [])

  const exitEdit = useCallback(() => {
    setState((prev) => ({
      ...prev,
      uiMode: "view",
      editingPageId: null,
    }))
  }, [])

  const isEdit = useCallback(
    (pageId?: string) => {
      if (state.uiMode !== "edit") return false
      if (pageId == null) return true
      return state.editingPageId === pageId
    },
    [state.uiMode, state.editingPageId]
  )

  return (
    <UIModeContext.Provider
      value={{
        state,
        uiMode: state.uiMode,
        setUIMode,
        enterEdit,
        exitEdit,
        isEdit,
      }}
    >
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
