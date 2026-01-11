/**
 * Apply Lookup Field Filters to Supabase Query
 * 
 * Applies lookup field filters to a Supabase query builder,
 * resolving dynamic values and returning information about active/skipped filters
 */

import type { LookupFieldFilter } from '@/types/fields'
import { resolveFilterValue, type ResolveFilterValueContext } from './resolveFilterValue'

export interface ApplyLookupFiltersOptions {
  query: any // Supabase query builder
  filters: LookupFieldFilter[]
  lookupTableFields: Array<{ name: string; type: string }> // Fields in lookup table
  context: ResolveFilterValueContext
}

export interface ActiveFilter {
  filter: LookupFieldFilter
  resolvedValue: any
  resolvedValue2?: any
}

export interface ApplyLookupFiltersResult {
  query: any
  activeFilters: ActiveFilter[]
  skippedFilters: LookupFieldFilter[]
}

/**
 * Applies lookup field filters to a Supabase query
 * Returns the modified query and information about active filters
 */
export async function applyLookupFilters(
  options: ApplyLookupFiltersOptions
): Promise<ApplyLookupFiltersResult> {
  const { filters, lookupTableFields, context } = options
  let query = options.query
  
  if (!filters || filters.length === 0) {
    return { query, activeFilters: [], skippedFilters: [] }
  }
  
  const activeFilters: ActiveFilter[] = []
  const skippedFilters: LookupFieldFilter[] = []
  
  for (const filter of filters) {
    // Resolve filter value
    const { value, value2, shouldApply } = await resolveFilterValue(filter, context)
    
    if (!shouldApply || (value === null && filter.operator !== 'is_empty')) {
      skippedFilters.push(filter)
      continue
    }
    
    // Validate field exists in lookup table
    const lookupField = lookupTableFields.find(f => f.name === filter.field)
    if (!lookupField) {
      console.warn(`Lookup filter field "${filter.field}" not found in lookup table`)
      skippedFilters.push(filter)
      continue
    }
    
    // Apply filter to query
    const fieldName = filter.field
    const fieldType = lookupField.type
    
    try {
      switch (filter.operator) {
        case 'equal':
          query = query.eq(fieldName, value)
          break
        case 'not_equal':
          query = query.neq(fieldName, value)
          break
        case 'contains':
          if (fieldType === 'text' || fieldType === 'long_text') {
            query = query.ilike(fieldName, `%${value}%`)
          } else {
            // For other types, convert to string for contains
            query = query.ilike(fieldName, `%${String(value)}%`)
          }
          break
        case 'not_contains':
          query = query.not(fieldName, 'ilike', `%${value}%`)
          break
        case 'greater_than':
          query = query.gt(fieldName, value)
          break
        case 'less_than':
          query = query.lt(fieldName, value)
          break
        case 'greater_than_or_equal':
          query = query.gte(fieldName, value)
          break
        case 'less_than_or_equal':
          query = query.lte(fieldName, value)
          break
        case 'is_empty':
          query = query.or(`${fieldName}.is.null,${fieldName}.eq.`)
          break
        case 'is_not_empty':
          query = query.not(fieldName, 'is', null)
          query = query.neq(fieldName, '')
          break
        case 'date_range':
          if (value && value2) {
            query = query.gte(fieldName, value).lte(fieldName, value2)
          } else if (value) {
            query = query.gte(fieldName, value)
          } else if (value2) {
            query = query.lte(fieldName, value2)
          } else {
            skippedFilters.push(filter)
            continue
          }
          break
        default:
          console.warn(`Unknown lookup filter operator: ${filter.operator}`)
          skippedFilters.push(filter)
          continue
      }
      
      activeFilters.push({ filter, resolvedValue: value, resolvedValue2: value2 })
    } catch (error) {
      console.error(`Error applying lookup filter:`, error)
      skippedFilters.push(filter)
    }
  }
  
  return { query, activeFilters, skippedFilters }
}
