'use client'

/**
 * Page Renderer Component
 * Unified Canvas + Blocks Architecture:
 * - Pages are containers only - they provide context (pageId, optional recordId)
 * - All pages render Canvas - no conditional rendering based on page type
 * - Blocks define behaviour, layout, and data
 * 
 * ARCHITECTURE NOTE: All pages are canvas-based by design.
 * Views (calendar, grid, dashboard) are implemented as blocks, not page types.
 * Only 'content' and 'record_view' page types exist in the UI.
 */

import type { InterfacePage } from '@/lib/interface/page-types-only'
import { useMemo, useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { getPageTableId } from '@/lib/interface/page-table-utils'
import { assertPageIsValid } from '@/lib/interface/assertPageIsValid'
import PageSetupState from './PageSetupState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

// Lazy load InterfaceBuilder (which wraps Canvas)
const InterfaceBuilder = dynamic(() => import('@/components/interface/InterfaceBuilder'), { ssr: false })

interface PageRendererProps {
  page: InterfacePage
  data?: any[] // Data from SQL view
  isLoading?: boolean
  onGridToggle?: () => void
  showGridToggle?: boolean
  blocks?: any[] // Blocks for dashboard/overview/content pages
}

interface PageRendererWithSetupProps extends PageRendererProps {
  isAdmin?: boolean
  onOpenSettings?: () => void
}

export default function PageRenderer({
  page,
  data = [],
  isLoading = false,
  onGridToggle,
  showGridToggle = false,
  blocks = [],
  isAdmin = false,
  onOpenSettings,
}: PageRendererWithSetupProps) {
  const [pageTableId, setPageTableId] = useState<string | null>(null)
  const prevPageIdRef = useRef<string>('')
  const prevBaseTableRef = useRef<string | null>(null)
  const prevSavedViewIdRef = useRef<string | null>(null)

  // CRITICAL: Memoize InterfaceBuilder page props to prevent remounts
  // All pages use the same structure - no page-type-specific config
  const canvasPage = useMemo(() => ({
    id: page.id,
    name: page.name,
    settings: { 
      layout_template: 'content' as const,
      primary_table_id: pageTableId 
    }
  }), [page.id, page.name, pageTableId])

  // Extract tableId from page - only update when relevant page properties change
  useEffect(() => {
    const pageId = page?.id || ''
    const baseTable = page?.base_table || null
    const savedViewId = page?.saved_view_id || null
    
    // Only run if page properties actually changed
    if (
      prevPageIdRef.current === pageId &&
      prevBaseTableRef.current === baseTable &&
      prevSavedViewIdRef.current === savedViewId
    ) {
      return
    }
    
    // Update refs
    prevPageIdRef.current = pageId
    prevBaseTableRef.current = baseTable
    prevSavedViewIdRef.current = savedViewId
    
    getPageTableId(page).then(tableId => {
      setPageTableId(prev => {
        // Only update if value actually changed
        if (prev !== tableId) {
          return tableId
        }
        return prev
      })
    })
  }, [page?.id, page?.base_table, page?.saved_view_id])

  // Extract recordId from page config if this is a record_view page
  const recordId = page.page_type === 'record_view' ? (page.config?.record_id || null) : null

  // Render content - ALL pages render Canvas via InterfaceBuilder
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-500">Loading...</div>
        </div>
      )
    }

    // Pre-deployment guard: Validate page before rendering
    // Invalid pages show setup UI instead of redirecting
    const pageValidity = assertPageIsValid(page, {
      hasBlocks: blocks.length > 0,
      hasTableId: !!pageTableId,
    })
    
    // If page is invalid due to missing anchor, show setup UI
    // DO NOT redirect - always render UI
    if (!pageValidity.valid && pageValidity.missingAnchor) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[PageGuard] Page ${page.id} missing anchor - showing setup UI:`, pageValidity.reason)
      }
      // Show PageSetupState for invalid pages - provides contextual setup guidance
      return <PageSetupState page={page} isAdmin={isAdmin} onOpenSettings={onOpenSettings} />
    }
    
    // Log other validation issues in dev mode but continue rendering
    if (process.env.NODE_ENV === 'development' && !pageValidity.valid) {
      console.warn(`[PageGuard] Page ${page.id} validation issue (rendering anyway):`, pageValidity.reason)
    }

    // UNIFIED: All pages render Canvas via InterfaceBuilder
    // Page type only determines context (recordId injection for record_view)
    // Allow editing if user is admin - pages can enter edit mode to edit text blocks
    return (
      <InterfaceBuilder
        key={`canvas-${page.id}`}
        page={canvasPage as any}
        initialBlocks={blocks}
        isViewer={false}
        hideHeader={true}
        pageTableId={pageTableId}
        recordId={recordId}
        mode={page.page_type === 'record_view' ? 'view' : 'view'}
      />
    )
  }

  // ALWAYS return UI - never return null
  // Get content from renderContent - it should never return null
  const content = renderContent()
  
  // Fallback UI if renderContent somehow returns null (defensive)
  if (!content) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[PageRenderer] renderContent returned null - this should never happen')
    }
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Unable to render page</h2>
          <p className="text-sm text-gray-500">The page could not be rendered. Please check the configuration.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Content - always Canvas */}
      <div className="flex-1 overflow-auto">
        {content}
      </div>
    </div>
  )
}


