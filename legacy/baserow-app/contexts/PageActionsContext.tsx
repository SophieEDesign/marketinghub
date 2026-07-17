"use client"

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react"

export interface PageActions {
  onOpenPageSettings: () => void
  /** Enter edit mode (blocks/pages). Shown when not editing. */
  onEnterEdit?: () => void
  /** Exit edit mode. Shown when editing. */
  onExitEdit?: () => void
  /** Whether the page is currently in edit mode. */
  isEditing?: boolean
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

  const contextValue = useMemo(() => ({
    pageActions,
    registerPageActions,
    unregisterPageActions,
  }), [pageActions, registerPageActions, unregisterPageActions])

  return (
    <PageActionsContext.Provider value={contextValue}>
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
