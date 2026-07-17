"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

export type UIMode =
  | "view"
  | "editPages"
  | "recordLayoutEdit"
  | "fieldSchemaEdit"

interface UIStateContextType {
  uiMode: UIMode
  setUIMode: (mode: UIMode) => void
}

const UIStateContext = createContext<UIStateContextType | undefined>(undefined)

export function UIStateProvider({ children }: { children: ReactNode }) {
  const [uiMode, setUiModeState] = useState<UIMode>("view")

  const setUIMode = useCallback((mode: UIMode) => {
    setUiModeState(mode)
  }, [])

  return (
    <UIStateContext.Provider value={{ uiMode, setUIMode }}>
      {children}
    </UIStateContext.Provider>
  )
}

export function useUIState() {
  const context = useContext(UIStateContext)
  if (context === undefined) {
    throw new Error("useUIState must be used within UIStateProvider")
  }
  return context
}

export const UIMODE_LABELS: Record<UIMode, string> = {
  view: "",
  editPages: "Editing Pages",
  recordLayoutEdit: "Editing Record Layout",
  fieldSchemaEdit: "Editing Field Schema",
}
