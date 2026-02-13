"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"

/**
 * Unified UI mode (Airtable-style).
 * Only one non-view mode can be active at a time.
 */
export type UIMode =
  | "view"              // Default: browsing
  | "editPages"         // Editing page layout / blocks (sidebar reorder when on page)
  | "recordLayoutEdit" // Editing record modal/panel field layout
  | "fieldSchemaEdit"  // Field settings drawer open (drawer handles save)

export interface UIModeState {
  uiMode: UIMode
  /** When in editPages, which page is being edited (if any). */
  editingPageId: string | null
}

interface UIModeContextType {
  state: UIModeState
  uiMode: UIMode
  setUIMode: (mode: UIMode) => void
  enterEditPages: (pageId?: string) => void
  exitEditPages: () => void
  enterRecordLayoutEdit: () => void
  exitRecordLayoutEdit: () => void
  enterFieldSchemaEdit: () => void
  exitFieldSchemaEdit: () => void
  /** True when uiMode === 'editPages' and (optional) editingPageId matches. */
  isEditPages: (pageId?: string) => boolean
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
      editingPageId: mode === "editPages" ? prev.editingPageId : null,
    }))
  }, [])

  const enterEditPages = useCallback((pageId?: string) => {
    setState((prev) => ({
      uiMode: "editPages",
      editingPageId: pageId ?? prev.editingPageId ?? null,
    }))
  }, [])

  const exitEditPages = useCallback(() => {
    setState((prev) => ({
      ...prev,
      uiMode: "view",
      editingPageId: null,
    }))
  }, [])

  const enterRecordLayoutEdit = useCallback(() => {
    setState({ uiMode: "recordLayoutEdit", editingPageId: null })
  }, [])

  const exitRecordLayoutEdit = useCallback(() => {
    setState((prev) => ({
      ...prev,
      uiMode: "view",
      editingPageId: null,
    }))
  }, [])

  const enterFieldSchemaEdit = useCallback(() => {
    setState({ uiMode: "fieldSchemaEdit", editingPageId: null })
  }, [])

  const exitFieldSchemaEdit = useCallback(() => {
    setState((prev) => ({
      ...prev,
      uiMode: "view",
      editingPageId: null,
    }))
  }, [])

  const isEditPages = useCallback(
    (pageId?: string) => {
      if (state.uiMode !== "editPages") return false
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
        enterEditPages,
        exitEditPages,
        enterRecordLayoutEdit,
        exitRecordLayoutEdit,
        enterFieldSchemaEdit,
        exitFieldSchemaEdit,
        isEditPages,
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
