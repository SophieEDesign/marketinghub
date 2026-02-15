"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"

export interface PageActions {
  onOpenPageSettings: () => void
}

interface PageActionsContextType {
  /** Currently registered page actions (from the active interface page). */
  pageActions: PageActions | null
  /** Register handlers for the current interface page. Called when InterfacePageClient mounts. */
  registerPageActions: (actions: PageActions) => void
  /** Unregister handlers. Called when InterfacePageClient unmounts. */
  unregisterPageActions: () => void
}

const PageActionsContext = createContext<PageActionsContextType | undefined>(undefined)

export function PageActionsProvider({ children }: { children: ReactNode }) {
  const [pageActions, setPageActions] = useState<PageActions | null>(null)

  const registerPageActions = useCallback((actions: PageActions) => {
    setPageActions(actions)
  }, [])

  const unregisterPageActions = useCallback(() => {
    setPageActions(null)
  }, [])

  return (
    <PageActionsContext.Provider
      value={{ pageActions, registerPageActions, unregisterPageActions }}
    >
      {children}
    </PageActionsContext.Provider>
  )
}

export function usePageActions() {
  const context = useContext(PageActionsContext)
  if (context === undefined) {
    throw new Error("usePageActions must be used within PageActionsProvider")
  }
  return context
}
