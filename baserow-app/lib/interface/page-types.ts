/**
 * Page Type Definitions
 * Page types are visualizations only - they define HOW data is displayed, not WHAT data.
 */

export type PageType = 
  | 'list'
  | 'gallery'
  | 'kanban'
  | 'calendar'
  | 'timeline'
  | 'form'
  | 'dashboard'
  | 'overview'
  | 'record_review'
  // 'blank' removed - invalid page type, pages must have an anchor

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
  list: {
    type: 'list',
    label: 'List',
    description: 'Grid view with columns and rows',
    requiresSourceView: true,
    requiresBaseTable: false,
    supportsGridToggle: true,
    allowsInlineEditing: true,
  },
  gallery: {
    type: 'gallery',
    label: 'Gallery',
    description: 'Card-based visual layout',
    requiresSourceView: true,
    requiresBaseTable: false,
    supportsGridToggle: true,
    allowsInlineEditing: false,
  },
  kanban: {
    type: 'kanban',
    label: 'Kanban',
    description: 'Board view with drag-and-drop columns',
    requiresSourceView: true,
    requiresBaseTable: false,
    supportsGridToggle: true,
    allowsInlineEditing: false,
  },
  calendar: {
    type: 'calendar',
    label: 'Calendar',
    description: 'Month/week calendar view',
    requiresSourceView: true,
    requiresBaseTable: false,
    supportsGridToggle: true,
    allowsInlineEditing: false,
  },
  timeline: {
    type: 'timeline',
    label: 'Timeline',
    description: 'Chronological timeline view',
    requiresSourceView: true,
    requiresBaseTable: false,
    supportsGridToggle: true,
    allowsInlineEditing: false,
  },
  form: {
    type: 'form',
    label: 'Form',
    description: 'Data collection form for record creation',
    requiresSourceView: false,
    requiresBaseTable: true,
    supportsGridToggle: false,
    allowsInlineEditing: false,
  },
  dashboard: {
    type: 'dashboard',
    label: 'Dashboard',
    description: 'Overview with KPIs, charts, and metrics',
    requiresSourceView: true,
    requiresBaseTable: false,
    supportsGridToggle: false,
    allowsInlineEditing: false,
  },
  overview: {
    type: 'overview',
    label: 'Overview',
    description: 'Navigation and information page',
    requiresSourceView: false,
    requiresBaseTable: false,
    supportsGridToggle: false,
    allowsInlineEditing: false,
  },
  record_review: {
    type: 'record_review',
    label: 'Record Review',
    description: 'Record switching with detail panel',
    requiresSourceView: true,
    requiresBaseTable: false,
    supportsGridToggle: true,
    allowsInlineEditing: false,
  },
  // blank removed - invalid page type
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
 * Get the required anchor type for a page type
 */
export function getRequiredAnchorType(pageType: PageType): 'saved_view' | 'dashboard' | 'form' | 'record' {
  switch (pageType) {
    case 'list':
    case 'gallery':
    case 'kanban':
    case 'calendar':
    case 'timeline':
    case 'record_review':
      return 'saved_view'
    case 'dashboard':
    case 'overview':
      return 'dashboard'
    case 'form':
      return 'form'
    default:
      throw new Error(`Unknown page type: ${pageType}`)
  }
}

/**
 * Validate that a page has the correct anchor for its type
 */
export function validatePageAnchor(
  pageType: PageType,
  savedViewId: string | null,
  dashboardLayoutId: string | null,
  formConfigId: string | null,
  recordConfigId: string | null
): { valid: boolean; error?: string } {
  const requiredAnchor = getRequiredAnchorType(pageType)
  
  switch (requiredAnchor) {
    case 'saved_view':
      if (!savedViewId) {
        return { valid: false, error: `${pageType} pages require a saved view` }
      }
      break
    case 'dashboard':
      if (!dashboardLayoutId) {
        return { valid: false, error: `${pageType} pages require a dashboard layout` }
      }
      break
    case 'form':
      if (!formConfigId) {
        return { valid: false, error: `${pageType} pages require form configuration` }
      }
      break
    case 'record':
      if (!recordConfigId) {
        return { valid: false, error: `${pageType} pages require record configuration` }
      }
      break
  }

  // Ensure only one anchor is set
  const anchorCount = [
    savedViewId,
    dashboardLayoutId,
    formConfigId,
    recordConfigId,
  ].filter(Boolean).length

  if (anchorCount !== 1) {
    return { valid: false, error: 'Page must have exactly one anchor' }
  }

  return { valid: true }
}

