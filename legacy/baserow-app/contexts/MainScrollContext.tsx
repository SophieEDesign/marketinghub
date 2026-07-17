"use client"

import { createContext, useContext, useState, useCallback } from "react"

/**
 * When true, the workspace main area must not scroll (overflow-hidden).
 * Used for full-page content pages (e.g. full-page calendar) so the page and canvas never scroll;
 * only block-internal content may scroll, or for calendar, navigation is used instead.
 */
interface MainScrollContextValue {
  suppressMainScroll: boolean
  setSuppressMainScroll: (suppress: boolean) => void
}

const MainScrollContext = createContext<MainScrollContextValue | null>(null)

export function MainScrollProvider({ children }: { children: React.ReactNode }) {
  const [suppressMainScroll, setSuppressMainScroll] = useState(false)
  const setter = useCallback((suppress: boolean) => {
    setSuppressMainScroll(suppress)
  }, [])
  return (
    <MainScrollContext.Provider value={{ suppressMainScroll, setSuppressMainScroll: setter }}>
      {children}
    </MainScrollContext.Provider>
  )
}

export function useMainScroll() {
  const ctx = useContext(MainScrollContext)
  return ctx
}
