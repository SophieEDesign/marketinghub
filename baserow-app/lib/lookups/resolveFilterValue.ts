/**
 * Filter Value Resolution for Lookup Fields
 * 
 * Resolves filter values based on their source type (static, current_record, context)
 */

import type { LookupFieldFilter } from '@/types/fields'

export interface ResolveFilterValueContext {
  currentRecord?: Record<string, any> // Current record being edited/viewed
  currentUserId?: string // Current user ID from auth
  currentUserEmail?: string // Current user email from auth
}

export interface ResolvedFilterValue {
  value: any
  value2?: any
  shouldApply: boolean
}

/**
 * Resolves the value for a lookup field filter based on its valueSource
 */
export async function resolveFilterValue(
  filter: LookupFieldFilter,
  context: ResolveFilterValueContext
): Promise<ResolvedFilterValue> {
  const { currentRecord, currentUserId, currentUserEmail } = context
  
  // Check if filter should be skipped (applyOnlyWhenFieldHasValue)
  if (filter.applyOnlyWhenFieldHasValue && filter.valueSource === 'current_record') {
    const fieldValue = currentRecord?.[filter.currentRecordField || '']
    if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
      return { value: null, shouldApply: false }
    }
  }
  
  let value: any = null
  let value2: any = undefined
  
  switch (filter.valueSource) {
    case 'static':
      value = filter.value
      value2 = filter.value2
      break
      
    case 'current_record':
      if (!filter.currentRecordField) {
        return { value: null, shouldApply: false }
      }
      value = currentRecord?.[filter.currentRecordField]
      value2 = filter.currentRecordField2 ? currentRecord?.[filter.currentRecordField2] : undefined
      
      // Skip if value is null/empty (unless applyOnlyWhenFieldHasValue handles it)
      if (!filter.applyOnlyWhenFieldHasValue && (value === null || value === undefined || value === '')) {
        return { value: null, shouldApply: false }
      }
      break
      
    case 'context':
      switch (filter.contextType) {
        case 'current_user_id':
          value = currentUserId
          break
        case 'current_user_email':
          value = currentUserEmail
          break
        case 'current_date':
          value = new Date().toISOString().split('T')[0] // YYYY-MM-DD
          break
        case 'current_datetime':
          value = new Date().toISOString()
          break
        default:
          return { value: null, shouldApply: false }
      }
      // Handle value2 for context (e.g., date ranges)
      if (filter.operator === 'date_range' && filter.contextType2) {
        switch (filter.contextType2) {
          case 'current_date':
            value2 = new Date().toISOString().split('T')[0]
            break
          case 'current_datetime':
            value2 = new Date().toISOString()
            break
        }
      }
      break
      
    default:
      return { value: null, shouldApply: false }
  }
  
  return { value, value2, shouldApply: true }
}
