/**
 * Data Wiring Guards
 * 
 * Ensures data loading failures are visible and safe.
 * Logs diagnostics in dev mode, preserves last good data, shows setup UI if wiring missing.
 */

const isDev = typeof window !== 'undefined' && process.env.NODE_ENV === 'development'

// Enable diagnostics via window.__DEV_DIAGNOSTICS__
declare global {
  interface Window {
    __DEV_DIAGNOSTICS__?: boolean
  }
}

const diagnosticsEnabled = () => {
  return isDev && (window.__DEV_DIAGNOSTICS__ !== false)
}

/**
 * Log table resolution with diagnostics
 */
export function logTableResolution(
  tableId: string | null,
  tableName: string | null,
  success: boolean,
  error?: string
) {
  if (!diagnosticsEnabled()) return

  if (success && tableName) {
    console.log(`[DataWiring] Table resolved: ${tableId} -> ${tableName}`)
  } else {
    console.warn(`[DataWiring] Table resolution failed: ${tableId}`, error)
  }
}

/**
 * Log field resolution with diagnostics
 */
export function logFieldResolution(
  fieldId: string | null,
  fieldName: string | null,
  fieldType: string | null,
  success: boolean,
  error?: string
) {
  if (!diagnosticsEnabled()) return

  if (success && fieldName) {
    console.log(`[DataWiring] Field resolved: ${fieldId} -> ${fieldName} (${fieldType})`)
  } else {
    console.warn(`[DataWiring] Field resolution failed: ${fieldId}`, error)
  }
}

/**
 * Log view resolution with diagnostics
 */
export function logViewResolution(
  viewId: string | null,
  viewName: string | null,
  viewType: string | null,
  success: boolean,
  error?: string
) {
  if (!diagnosticsEnabled()) return

  if (success && viewName) {
    console.log(`[DataWiring] View resolved: ${viewId} -> ${viewName} (${viewType})`)
  } else {
    console.warn(`[DataWiring] View resolution failed: ${viewId}`, error)
  }
}

/**
 * Log calendar date field resolution
 */
export function logCalendarDateField(
  fieldId: string | null,
  fieldName: string | null,
  success: boolean,
  eventCount: number = 0
) {
  if (!diagnosticsEnabled()) return

  if (success && fieldName) {
    console.log(`[Calendar] Date field resolved: ${fieldId} -> ${fieldName}, generated ${eventCount} events`)
  } else {
    console.warn(`[Calendar] Date field resolution failed: ${fieldId} - calendar will show setup UI`)
  }
}

/**
 * Log grid view fields
 */
export function logGridViewFields(
  viewId: string,
  visibleFields: Array<{ field_name: string; visible: boolean }>,
  totalFields: number
) {
  if (!diagnosticsEnabled()) return

  const visibleCount = visibleFields.filter(f => f.visible).length
  if (visibleCount === 0 && totalFields > 0) {
    console.warn(`[Grid] View ${viewId} has ${totalFields} fields but none are visible - grid may appear empty`)
  } else {
    console.log(`[Grid] View ${viewId} has ${visibleCount} visible fields out of ${totalFields} total`)
  }
}

/**
 * Log record review data
 */
export function logRecordReviewData(
  tableId: string,
  recordCount: number,
  displayedCount: number
) {
  if (!diagnosticsEnabled()) return

  if (recordCount > 0 && displayedCount === 0) {
    console.warn(
      `[RecordReview] Table ${tableId} has ${recordCount} records but none are displayed. ` +
      `Check filters or record source configuration.`
    )
  } else {
    console.log(`[RecordReview] Table ${tableId}: ${displayedCount} records displayed out of ${recordCount} total`)
  }
}

/**
 * Log data loading failure (non-blocking)
 */
export function logDataLoadingFailure(
  operation: string,
  resource: string,
  error: Error | string,
  preserveLastGoodData: boolean = true
) {
  if (!diagnosticsEnabled()) return

  const errorMessage = error instanceof Error ? error.message : error
  console.warn(
    `[DataWiring] ${operation} failed for ${resource}: ${errorMessage}. ` +
    `${preserveLastGoodData ? 'Preserving last good data.' : 'Showing setup UI.'}`
  )
}

/**
 * Validate data wiring before rendering
 * Returns true if setup UI should be shown
 */
export function shouldShowSetupUIForDataWiring(
  hasTableId: boolean,
  hasViewId: boolean,
  hasFields: boolean,
  pageType: string
): boolean {
  // Calendar pages need table and date field
  if (pageType === 'calendar' && !hasTableId) {
    if (diagnosticsEnabled()) {
      console.warn(`[DataWiring] Calendar page missing table_id - showing setup UI`)
    }
    return true
  }

  // Record review pages need table
  if (pageType === 'record_review' && !hasTableId) {
    if (diagnosticsEnabled()) {
      console.warn(`[DataWiring] Record review page missing table_id - showing setup UI`)
    }
    return true
  }

  // List/gallery/kanban pages need view
  if (['list', 'gallery', 'kanban'].includes(pageType) && !hasViewId) {
    if (diagnosticsEnabled()) {
      console.warn(`[DataWiring] ${pageType} page missing view_id - showing setup UI`)
    }
    return true
  }

  return false
}

