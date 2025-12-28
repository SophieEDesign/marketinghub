"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

type SidebarMode = "view" | "edit"

interface SidebarModeContextType {
  mode: SidebarMode
  setMode: (mode: SidebarMode) => void
  toggleMode: () => void
}

const SidebarModeContext = createContext<SidebarModeContextType | undefined>(undefined)

export function SidebarModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<SidebarMode>("view")

  // Load mode from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-mode")
    if (saved === "edit" || saved === "view") {
      setModeState(saved)
    }
  }, [])

  // Save mode to localStorage when it changes
  const setMode = (newMode: SidebarMode) => {
    setModeState(newMode)
    localStorage.setItem("sidebar-mode", newMode)
  }

  const toggleMode = () => {
    setMode(mode === "view" ? "edit" : "view")
  }

  return (
    <SidebarModeContext.Provider value={{ mode, setMode, toggleMode }}>
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

