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
  | 'blank'

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
  blank: {
    type: 'blank',
    label: 'Blank',
    description: 'Clean canvas with no assumptions',
    requiresSourceView: false,
    requiresBaseTable: false,
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

