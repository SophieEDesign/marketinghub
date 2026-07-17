/**
 * Pure helper to resolve calendar date field names from block config, view config, and table fields.
 * Used by CalendarView for event computation - no hooks, no side effects.
 * Returns stable field names or null for the "to" field.
 */

import type { TableField } from '@/types/fields'

export interface ResolvedDateFields {
  fromFieldName: string
  toFieldName: string | null
}

export interface ResolveDateFieldsParams {
  blockConfig?: Record<string, any>
  viewConfig?: {
    calendar_date_field?: string | null
    calendar_start_field?: string | null
    calendar_end_field?: string | null
  } | null
  loadedTableFields: TableField[]
  resolvedDateFieldId: string
  fallbackFromField?: string | null
  fallbackToField?: string | null
}

/**
 * Resolves from/to date field names from config.
 * Priority: block config > view config > auto-detect > fallback
 */
export function resolveCalendarDateFieldNames(params: ResolveDateFieldsParams): ResolvedDateFields {
  const {
    blockConfig = {},
    viewConfig = null,
    loadedTableFields,
    resolvedDateFieldId,
    fallbackFromField = null,
    fallbackToField = null,
  } = params

  const findDateField = (nameOrId: string | null | undefined): TableField | null => {
    if (!nameOrId || !loadedTableFields.length) return null
    return (
      loadedTableFields.find(
        (f) => (f.name === nameOrId || f.id === nameOrId) && f.type === 'date'
      ) ?? null
    )
  }

  // From field: block config > view config (start) > auto-detect > resolvedDateFieldId
  const blockFrom =
    blockConfig.date_from ||
    blockConfig.from_date_field ||
    blockConfig.start_date_field ||
    blockConfig.calendar_start_field ||
    blockConfig.date_field

  const resolvedFrom = findDateField(blockFrom)
  const viewStart = viewConfig?.calendar_start_field
  const resolvedViewStart = findDateField(viewStart)

  let autoFrom: TableField | null = null
  if (!resolvedFrom && !resolvedViewStart && !viewStart) {
    autoFrom =
      loadedTableFields.find(
        (f) =>
          f.type === 'date' &&
          (f.name.toLowerCase() === 'date_from' ||
            f.name.toLowerCase() === 'from_date' ||
            f.name.toLowerCase() === 'start_date' ||
            f.name.toLowerCase().includes('date_from') ||
            f.name.toLowerCase().includes('from_date'))
      ) ?? null
  }

  const fromFieldName =
    resolvedFrom?.name ||
    fallbackFromField ||
    resolvedViewStart?.name ||
    (typeof viewStart === 'string' ? viewStart : '') ||
    autoFrom?.name ||
    resolvedDateFieldId ||
    ''

  // To field: block config > view config (end) > auto-detect > null
  const blockTo =
    blockConfig.date_to ||
    blockConfig.to_date_field ||
    blockConfig.end_date_field ||
    blockConfig.calendar_end_field

  const resolvedTo = findDateField(blockTo)
  const viewEnd = viewConfig?.calendar_end_field
  const resolvedViewEnd = findDateField(viewEnd)

  let autoTo: TableField | null = null
  if (!resolvedTo && !resolvedViewEnd && !viewEnd) {
    autoTo =
      loadedTableFields.find(
        (f) =>
          f.type === 'date' &&
          (f.name.toLowerCase() === 'date_to' ||
            f.name.toLowerCase() === 'to_date' ||
            f.name.toLowerCase() === 'end_date' ||
            f.name.toLowerCase().includes('date_to') ||
            f.name.toLowerCase().includes('to_date'))
      ) ?? null
  }

  const toFieldName =
    resolvedTo?.name ||
    fallbackToField ||
    resolvedViewEnd?.name ||
    (typeof viewEnd === 'string' ? viewEnd : '') ||
    autoTo?.name ||
    null

  return { fromFieldName, toFieldName }
}
