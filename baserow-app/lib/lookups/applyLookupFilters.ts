/**
 * Apply Lookup Field Filters to Supabase Query
 * 
 * Applies lookup field filters to a Supabase query builder with support for
 * static values, current record values, and context values.
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
  const { query, filters, lookupTableFields, context } = options
  
  if (!filters || filters.length === 0) {
    return { query, activeFilters: [], skippedFilters: [] }
  }
  
  const activeFilters: ActiveFilter[] = []
  const skippedFilters: LookupFieldFilter[] = []
  let currentQuery = query
  
  for (const filter of filters) {
    // Resolve filter value
    const { value, value2, shouldApply } = await resolveFilterValue(filter, context)
    
    if (!shouldApply || value === null) {
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
          currentQuery = currentQuery.eq(fieldName, value)
          break
        case 'not_equal':
          currentQuery = currentQuery.neq(fieldName, value)
          break
        case 'contains':
          if (fieldType === 'text' || fieldType === 'long_text') {
            currentQuery = currentQuery.ilike(fieldName, `%${value}%`)
          } else {
            // For other types, convert to string for contains
            currentQuery = currentQuery.ilike(fieldName, `%${String(value)}%`)
          }
          break
        case 'not_contains':
          currentQuery = currentQuery.not(fieldName, 'ilike', `%${value}%`)
          break
        case 'greater_than':
          currentQuery = currentQuery.gt(fieldName, value)
          break
        case 'less_than':
          currentQuery = currentQuery.lt(fieldName, value)
          break
        case 'greater_than_or_equal':
          currentQuery = currentQuery.gte(fieldName, value)
          break
        case 'less_than_or_equal':
          currentQuery = currentQuery.lte(fieldName, value)
          break
        case 'is_empty':
          currentQuery = currentQuery.or(`${fieldName}.is.null,${fieldName}.eq.`)
          break
        case 'is_not_empty':
          currentQuery = currentQuery.not(fieldName, 'is', null)
          currentQuery = currentQuery.neq(fieldName, '')
          break
        case 'date_range':
          if (value && value2) {
            currentQuery = currentQuery.gte(fieldName, value).lte(fieldName, value2)
          } else if (value) {
            currentQuery = currentQuery.gte(fieldName, value)
          } else if (value2) {
            currentQuery = currentQuery.lte(fieldName, value2)
          }
          break
        default:
          console.warn(`Unknown lookup filter operator: ${filter.operator}`)
          skippedFilters.push(filter)
          continue
      }
      
      activeFilters.push({ 
        filter, 
        resolvedValue: value,
        resolvedValue2: value2
      })
    } catch (error) {
      console.error(`Error applying lookup filter:`, error)
      skippedFilters.push(filter)
    }
  }
  
  return { 
    query: currentQuery, 
    activeFilters, 
    skippedFilters 
  }
}
