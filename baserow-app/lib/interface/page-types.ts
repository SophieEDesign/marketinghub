/**
 * Page Type Definitions
 * 
 * Unified Canvas + Blocks Architecture:
 * - Pages are containers only - they provide context (pageId, optional recordId)
 * - All UI, data access, and behaviour lives inside blocks
 * - Only two page types exist: 'content' and 'record_view'
 */

export type PageType = 
  | 'content'      // Generic canvas page - no inherent data context
  | 'record_view'  // Canvas page with injected recordId - blocks may opt-in to record context

export interface PageTypeDefinition {
  type: PageType
  label: string
  description: string
  requiresSourceView: boolean
  requiresBaseTable: boolean
  supportsGridToggle: boolean
  allowsInlineEditing: boolean
}

export const PAGE_TYPE_DEFINITIONS: Record<PageType, PageTypeDefinition> = {
  content: {
    type: 'content',
    label: 'Content Page',
    description: 'Generic canvas page with blocks - no inherent data context',
    requiresSourceView: false,
    requiresBaseTable: false,
    supportsGridToggle: false,
    allowsInlineEditing: false,
  },
  record_view: {
    type: 'record_view',
    label: 'Record View',
    description: 'Canvas page with injected recordId - blocks may opt-in to record context',
    requiresSourceView: false,
    requiresBaseTable: false, // Optional - blocks define their own data sources
    supportsGridToggle: false,
    allowsInlineEditing: false,
  },
}

export function getPageTypeDefinition(type: PageType): PageTypeDefinition {
  return PAGE_TYPE_DEFINITIONS[type]
}

export function validatePageConfig(
  pageType: PageType,
  sourceView: string | null,
  baseTable: string | null
): { valid: boolean; error?: string } {
  const definition = PAGE_TYPE_DEFINITIONS[pageType]

  if (definition.requiresSourceView && !sourceView) {
    return {
      valid: false,
      error: `${definition.label} page type requires a source view`,
    }
  }

  if (definition.requiresBaseTable && !baseTable) {
    return {
      valid: false,
      error: `${definition.label} page type requires a base table`,
    }
  }

  return { valid: true }
}

/**
 * Check if a page type is a record view page (record-based)
 * Record view pages inject recordId context into blocks
 */
export function isRecordViewPage(pageType: PageType): boolean {
  return pageType === 'record_view'
}

/**
 * Get the required anchor type for a page type
 * In unified architecture, pages don't require anchors - blocks define their own data sources
 */
export function getRequiredAnchorType(pageType: PageType): 'saved_view' | 'dashboard' | 'form' | 'record' | null {
  // Pages don't require anchors - blocks define their own data sources
  return null
}

/**
 * Validate that a page has the correct anchor for its type
 * In unified architecture, pages don't require anchors - blocks define their own data sources
 */
export function validatePageAnchor(
  pageType: PageType,
  savedViewId: string | null,
  dashboardLayoutId: string | null,
  formConfigId: string | null,
  recordConfigId: string | null
): { valid: boolean; error?: string } {
  // Pages don't require anchors - blocks define their own data sources
  return { valid: true }
}

