"use client"

import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback, useMemo } from "react"
import { usePathname } from "next/navigation"

/**
 * Unified Edit Mode Context
 * 
 * Manages all editing states across the application:
 * - Sidebar editing (navigation structure)
 * - Page editing (page-level configuration)
 * - Block editing (dashboard/overview blocks)
 * - Record editing (individual records)
 * - Grid editing (field editing in grid views)
 * 
 * Provides a single source of truth for edit state with clear hierarchy.
 */

export type EditScope = 
  | "sidebar"      // Navigation structure editing
  | "page"         // Page-level editing (contextual based on page type)
  | "block"        // Block editing (dashboard/overview)
  | "record"       // Individual record editing
  | "grid"         // Grid field editing

export interface EditModeState {
  // Active editing scopes
  activeScopes: Set<EditScope>
  
  // Current page being edited (if any)
  editingPageId: string | null
  
  // Current record being edited (if any)
  editingRecordId: string | null
  
  // Current table/view being edited (if any)
  editingTableId: string | null
  editingViewId: string | null
}

interface EditModeContextType {
  // State
  state: EditModeState
  
  // Check if a scope is active
  isEditing: (scope: EditScope) => boolean
  
  // Check if any editing is active
  isAnyEditing: () => boolean
  
  // Enter edit mode for a scope
  enterEditMode: (scope: EditScope, options?: {
    pageId?: string
    recordId?: string
    tableId?: string
    viewId?: string
  }) => void
  
  // Exit edit mode for a scope
  exitEditMode: (scope: EditScope) => void
  
  // Toggle edit mode for a scope
  toggleEditMode: (scope: EditScope, options?: {
    pageId?: string
    recordId?: string
    tableId?: string
    viewId?: string
  }) => void
  
  // Exit all edit modes
  exitAllEditModes: () => void
  
  // Clear specific editing context
  clearEditingContext: (scope: EditScope) => void
}

const EditModeContext = createContext<EditModeContextType | undefined>(undefined)

interface EditModeProviderProps {
  children: ReactNode
  // Optional: Force viewer mode (no editing allowed)
  isViewer?: boolean
}

export function EditModeProvider({ children, isViewer = false }: EditModeProviderProps) {
  const pathname = usePathname()
  
  const [state, setState] = useState<EditModeState>({
    activeScopes: new Set(),
    editingPageId: null,
    editingRecordId: null,
    editingTableId: null,
    editingViewId: null,
  })

  // Load sidebar edit mode from localStorage on mount
  useEffect(() => {
    if (isViewer) return
    
    const saved = localStorage.getItem("sidebar-edit-mode")
    if (saved === "true") {
      setState(prev => ({
        ...prev,
        activeScopes: new Set([...prev.activeScopes, "sidebar"]),
      }))
    }
  }, [isViewer])

  // Save sidebar edit mode to localStorage when it changes
  useEffect(() => {
    if (isViewer) return
    
    const isSidebarEditing = state.activeScopes.has("sidebar")
    localStorage.setItem("sidebar-edit-mode", String(isSidebarEditing))
  }, [state.activeScopes, isViewer])

  // Load page edit mode from localStorage when page changes
  // CRITICAL: Reset edit mode when navigating to a different page to prevent mode leakage
  useEffect(() => {
    if (isViewer) return
    
    // Extract page ID from pathname if on a page route
    const pageMatch = pathname.match(/\/pages\/([^\/]+)/)
    if (pageMatch) {
      const pageId = pageMatch[1]
      
      setState(prev => {
        // CRITICAL: If we're navigating to a different page, clear page/block edit modes
        // This prevents edit mode from leaking between pages
        const isDifferentPage = prev.editingPageId !== null && prev.editingPageId !== pageId
        
        if (isDifferentPage) {
          // Clear page and block scopes when navigating to a different page
          const newScopes = new Set<EditScope>(prev.activeScopes)
          newScopes.delete("page")
          newScopes.delete("block")
          
          return {
            ...prev,
            activeScopes: newScopes,
            editingPageId: null, // Clear until we restore from localStorage
          }
        }
        
        return prev
      })
      
      // After clearing, restore edit mode from localStorage if saved for this page
      const saved = localStorage.getItem(`page-edit-mode-${pageId}`)
      if (saved === "true") {
        setState(prev => {
          // Only restore if we're still on the same page (prevent race conditions)
          const currentPageMatch = pathname.match(/\/pages\/([^\/]+)/)
          if (currentPageMatch && currentPageMatch[1] === pageId) {
            return {
              ...prev,
              activeScopes: new Set([...prev.activeScopes, "page"]),
              editingPageId: pageId,
            }
          }
          return prev
        })
      }
    } else {
      // Not on a page route - clear page/block edit modes
      setState(prev => {
        const newScopes = new Set<EditScope>(prev.activeScopes)
        newScopes.delete("page")
        newScopes.delete("block")
        
        return {
          ...prev,
          activeScopes: newScopes,
          editingPageId: null,
        }
      })
    }
  }, [pathname, isViewer])

  // Clear block scope when navigating to a different page (prevents edit state leakage)
  const prevPageIdRef = useRef<string | null>(null)
  useEffect(() => {
    const pageMatch = pathname.match(/\/pages\/([^\/]+)/)
    const pageId = pageMatch ? pageMatch[1] : null
    if (prevPageIdRef.current !== null && prevPageIdRef.current !== pageId) {
      setState(prev => {
        const newScopes = new Set(prev.activeScopes)
        newScopes.delete("block")
        return { ...prev, activeScopes: newScopes }
      })
    }
    prevPageIdRef.current = pageId
  }, [pathname])

  // Save page edit mode to localStorage when it changes
  useEffect(() => {
    if (isViewer || !state.editingPageId) return
    
    const isPageEditing = state.activeScopes.has("page")
    localStorage.setItem(`page-edit-mode-${state.editingPageId}`, String(isPageEditing))
  }, [state.activeScopes, state.editingPageId, isViewer])

  const isEditing = useCallback((scope: EditScope): boolean => {
    if (isViewer) return false
    return state.activeScopes.has(scope)
  }, [state.activeScopes, isViewer])

  const isAnyEditing = useCallback((): boolean => {
    if (isViewer) return false
    return state.activeScopes.size > 0
  }, [state.activeScopes, isViewer])

  const enterEditMode = useCallback((
    scope: EditScope,
    options?: {
      pageId?: string
      recordId?: string
      tableId?: string
      viewId?: string
    }
  ) => {
    if (isViewer) return

    setState((prev: EditModeState) => {
      const newScopes = new Set<EditScope>(prev.activeScopes)
      newScopes.add(scope)

      const updates: Partial<EditModeState> = {
        activeScopes: newScopes,
      }

      // Set context-specific IDs
      if (scope === "page" && options?.pageId) {
        updates.editingPageId = options.pageId
      } else if (scope === "block" && options?.pageId) {
        // Block editing also needs pageId to track which page is being edited
        updates.editingPageId = options.pageId
      } else if (scope === "record" && options?.recordId) {
        updates.editingRecordId = options.recordId
      } else if (scope === "grid") {
        if (options?.tableId) updates.editingTableId = options.tableId
        if (options?.viewId) updates.editingViewId = options.viewId
      }

      return { ...prev, ...updates }
    })
  }, [isViewer])

  const exitEditMode = useCallback((scope: EditScope) => {
    setState((prev: EditModeState) => {
      const newScopes = new Set<EditScope>(prev.activeScopes)
      newScopes.delete(scope)

      const updates: Partial<EditModeState> = {
        activeScopes: newScopes,
      }

      // Clear context-specific IDs
      if (scope === "page") {
        updates.editingPageId = null
      } else if (scope === "block") {
        // Don't clear editingPageId for block scope - it might be used by page scope too
        // Only clear if no other scopes are using it
      } else if (scope === "record") {
        updates.editingRecordId = null
      } else if (scope === "grid") {
        updates.editingTableId = null
        updates.editingViewId = null
      }

      return { ...prev, ...updates }
    })
  }, [])

  const toggleEditMode = useCallback((
    scope: EditScope,
    options?: {
      pageId?: string
      recordId?: string
      tableId?: string
      viewId?: string
    }
  ) => {
    if (isEditing(scope)) {
      exitEditMode(scope)
    } else {
      enterEditMode(scope, options)
    }
  }, [isEditing, exitEditMode, enterEditMode])

  const exitAllEditModes = useCallback(() => {
    setState({
      activeScopes: new Set(),
      editingPageId: null,
      editingRecordId: null,
      editingTableId: null,
      editingViewId: null,
    })
  }, [])

  const clearEditingContext = useCallback((scope: EditScope) => {
    exitEditMode(scope)
  }, [exitEditMode])

  const contextValue = useMemo(() => ({
    state,
    isEditing,
    isAnyEditing,
    enterEditMode,
    exitEditMode,
    toggleEditMode,
    exitAllEditModes,
    clearEditingContext,
  }), [
    state,
    isEditing,
    isAnyEditing,
    enterEditMode,
    exitEditMode,
    toggleEditMode,
    exitAllEditModes,
    clearEditingContext,
  ])

  return (
    <EditModeContext.Provider value={contextValue}>
      {children}
    </EditModeContext.Provider>
  )
}

/**
 * Hook to access edit mode context
 */
export function useEditMode() {
  const context = useContext(EditModeContext)
  if (context === undefined) {
    throw new Error("useEditMode must be used within an EditModeProvider")
  }
  return context
}

/**
 * Convenience hooks for specific scopes
 */
export function useSidebarEditMode() {
  const { isEditing, toggleEditMode, enterEditMode, exitEditMode } = useEditMode()
  return {
    isEditing: isEditing("sidebar"),
    toggle: () => toggleEditMode("sidebar"),
    enter: () => enterEditMode("sidebar"),
    exit: () => exitEditMode("sidebar"),
  }
}

export function usePageEditMode(pageId?: string) {
  const { isEditing, toggleEditMode, enterEditMode, exitEditMode, state } = useEditMode()
  const enter = useCallback(() => enterEditMode("page", pageId ? { pageId } : undefined), [enterEditMode, pageId])
  const exit = useCallback(() => exitEditMode("page"), [exitEditMode])
  const toggle = useCallback(() => toggleEditMode("page", pageId ? { pageId } : undefined), [toggleEditMode, pageId])
  return useMemo(() => ({
    isEditing: isEditing("page") && (!pageId || state.editingPageId === pageId),
    toggle,
    enter,
    exit,
    editingPageId: state.editingPageId,
  }), [isEditing("page"), pageId, state.editingPageId, toggle, enter, exit])
}

export function useBlockEditMode(pageId?: string) {
  const { isEditing, toggleEditMode, enterEditMode, exitEditMode, state } = useEditMode()
  const enter = useCallback(() => enterEditMode("block", pageId ? { pageId } : undefined), [enterEditMode, pageId])
  const exit = useCallback(() => exitEditMode("block"), [exitEditMode])
  const toggle = useCallback(() => toggleEditMode("block", pageId ? { pageId } : undefined), [toggleEditMode, pageId])
  return useMemo(() => ({
    isEditing: isEditing("block") && (!pageId || state.editingPageId === pageId),
    toggle,
    enter,
    exit,
  }), [isEditing("block"), pageId, state.editingPageId, toggle, enter, exit])
}

export function useRecordEditMode(recordId?: string) {
  const { isEditing, toggleEditMode, enterEditMode, exitEditMode, state } = useEditMode()
  return {
    isEditing: isEditing("record") && (!recordId || state.editingRecordId === recordId),
    toggle: () => toggleEditMode("record", recordId ? { recordId } : undefined),
    enter: () => enterEditMode("record", recordId ? { recordId } : undefined),
    exit: () => exitEditMode("record"),
    editingRecordId: state.editingRecordId,
  }
}

export function useGridEditMode(tableId?: string, viewId?: string) {
  const { isEditing, toggleEditMode, enterEditMode, exitEditMode, state } = useEditMode()
  return {
    isEditing: isEditing("grid") && 
      (!tableId || state.editingTableId === tableId) &&
      (!viewId || state.editingViewId === viewId),
    toggle: () => toggleEditMode("grid", { tableId, viewId }),
    enter: () => enterEditMode("grid", { tableId, viewId }),
    exit: () => exitEditMode("grid"),
    editingTableId: state.editingTableId,
    editingViewId: state.editingViewId,
  }
}

