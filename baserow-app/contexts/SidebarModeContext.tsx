"use client"

import { createContext, useContext, useEffect, useCallback, useMemo, ReactNode } from "react"
import { useEditMode } from "./EditModeContext"

/**
 * SidebarModeContext - Backward compatibility wrapper
 * 
 * This context is now a thin wrapper around the unified EditModeContext
 * to maintain backward compatibility with existing components.
 * 
 * @deprecated Use useSidebarEditMode() from EditModeContext instead
 */

type SidebarMode = "view" | "edit"

interface SidebarModeContextType {
  mode: SidebarMode
  setMode: (mode: SidebarMode) => void
  toggleMode: () => void
}

const SidebarModeContext = createContext<SidebarModeContextType | undefined>(undefined)

export function SidebarModeProvider({ children }: { children: ReactNode }) {
  const { isEditing, toggleEditMode, enterEditMode, exitEditMode } = useEditMode()

  const isSidebarEditing = isEditing("sidebar")
  const mode: SidebarMode = isSidebarEditing ? "edit" : "view"

  const setMode = useCallback(
    (newMode: SidebarMode) => {
      if (newMode === "edit") {
        enterEditMode("sidebar")
      } else {
        exitEditMode("sidebar")
      }
    },
    [enterEditMode, exitEditMode]
  )

  const toggleMode = useCallback(() => {
    toggleEditMode("sidebar")
  }, [toggleEditMode])

  const value = useMemo(
    () => ({ mode, setMode, toggleMode }),
    [mode, setMode, toggleMode]
  )

  return (
    <SidebarModeContext.Provider value={value}>
      {children}
    </SidebarModeContext.Provider>
  )
}

export function useSidebarMode() {
  const context = useContext(SidebarModeContext)
  if (context === undefined) {
    throw new Error("useSidebarMode must be used within a SidebarModeProvider")
  }
  return context
}

