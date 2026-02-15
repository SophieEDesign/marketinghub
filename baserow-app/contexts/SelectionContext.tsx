"use client"

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react"

export type SelectedContext =
  | { type: "page" }
  | { type: "block"; blockId: string }
  | { type: "record"; recordId: string; tableId?: string }
  | { type: "field"; fieldId: string; tableId: string }
  | null

interface SelectionContextType {
  selectedContext: SelectedContext
  setSelectedContext: (ctx: SelectedContext) => void
}

const SelectionContext = createContext<SelectionContextType | undefined>(undefined)

export function SelectionContextProvider({ children }: { children: ReactNode }) {
  const [selectedContext, setSelectedContextState] = useState<SelectedContext>(null)

  const setSelectedContext = useCallback((ctx: SelectedContext) => {
    setSelectedContextState(ctx)
  }, [])

  // Clean exit: Esc key clears selection (Step 11)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedContext) {
        setSelectedContextState(null)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedContext])

  return (
    <SelectionContext.Provider value={{ selectedContext, setSelectedContext }}>
      {children}
    </SelectionContext.Provider>
  )
}

export function useSelectionContext() {
  const context = useContext(SelectionContext)
  if (context === undefined) {
    throw new Error("useSelectionContext must be used within SelectionContextProvider")
  }
  return context
}
