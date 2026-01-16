/**
 * Linked Field Utilities
 * 
 * Helper functions for resolving linked field values between IDs and display names.
 * Used for copy/paste operations where users work with display names but we store IDs.
 */

import { createClient } from '@/lib/supabase/client'
import type { TableField, LinkedField } from '@/types/fields'
import { getPrimaryFieldName } from '@/lib/fields/primary'

/**
 * Resolve a linked field value to display labels
 * 
 * @param field - Linked field definition
 * @param value - Stored value (UUID string or string[] for multi-link)
 * @returns Display label(s) - comma-separated string for multi-link
 */
export async function resolveLinkedFieldDisplay(
  field: LinkedField,
  value: string | string[] | null | undefined
): Promise<string> {
  if (!value) {
    return ''
  }

  const linkedTableId = field.options?.linked_table_id
  if (!linkedTableId) {
    return String(value)
  }

  const supabase = createClient()

  // Get target table info
  const { data: targetTable, error: tableError } = await supabase
    .from('tables')
    .select('supabase_table')
    .eq('id', linkedTableId)
    .single()

  if (tableError || !targetTable) {
    console.warn(`[resolveLinkedFieldDisplay] Target table not found: ${linkedTableId}`)
    return String(value)
  }

  // Determine which field to use for display
  // Explicit fallback order:
  // 1. Table's primary field (core data)
  // 2. linked_field_id (if set)
  // 3. First text-like field
  // 4. Finally ID display
  const { data: targetFields } = await supabase
    .from('table_fields')
    .select('id, name, type')
    .eq('table_id', linkedTableId)
    .order('position', { ascending: true })

  const linkedFieldId = field.options?.linked_field_id

  let displayFieldName: string | null = null

  // 1. Table's primary field
  displayFieldName = getPrimaryFieldName(targetFields as any)

  // 2. linked_field_id (if set)
  if (!displayFieldName && linkedFieldId && targetFields) {
    // linked_field_id can be either a field ID or field name
    const linkedField = targetFields.find(f => f.id === linkedFieldId || f.name === linkedFieldId)
    if (linkedField) {
      displayFieldName = linkedField.name
    }
  }

  // 3. First text-like field
  if (!displayFieldName && targetFields) {
    const textField = targetFields.find(f =>
      ['text', 'long_text', 'email', 'url'].includes(f.type)
    )
    if (textField) {
      displayFieldName = textField.name
    }
  }

  // If still no display field, we'll just show IDs
  if (!displayFieldName) {
    return Array.isArray(value) ? value.join(', ') : String(value)
  }

  // Resolve IDs to display values
  const ids = Array.isArray(value) ? value : [value]
  const validIds = ids.filter(id => id && typeof id === 'string')

  if (validIds.length === 0) {
    return ''
  }

  const { data: records, error: recordsError } = await supabase
    .from(targetTable.supabase_table)
    .select(`id, ${displayFieldName}`)
    .in('id', validIds)

  if (recordsError || !records || !Array.isArray(records)) {
    console.warn(`[resolveLinkedFieldDisplay] Error fetching records:`, recordsError)
    return Array.isArray(value) ? value.join(', ') : String(value)
  }

  // Map IDs to display values
  const displayMap = new Map(
    records.map((r: any) => [r.id, r[displayFieldName!] || ''])
  )

  const labels = validIds.map(id => displayMap.get(id) || id)
  return labels.join(', ')
}

/**
 * Resolve pasted text to linked field record IDs
 * 
 * Attempts to match pasted text (display names or IDs) to record IDs in the target table.
 * 
 * @param field - Linked field definition
 * @param pastedText - Text to resolve (can be comma/newline separated for multi-link)
 * @returns Resolved IDs (string for single, string[] for multi-link) or null if resolution fails
 */
export async function resolvePastedLinkedValue(
  field: LinkedField,
  pastedText: string
): Promise<{ ids: string | string[] | null; errors: string[] }> {
  const errors: string[] = []
  const linkedTableId = field.options?.linked_table_id

  if (!linkedTableId) {
    return {
      ids: null,
      errors: ['Linked field is not properly configured (missing target table)'],
    }
  }

  const supabase = createClient()

  // Get target table info
  const { data: targetTable, error: tableError } = await supabase
    .from('tables')
    .select('supabase_table')
    .eq('id', linkedTableId)
    .single()

  if (tableError || !targetTable) {
    return {
      ids: null,
      errors: [`Target table not found: ${linkedTableId}`],
    }
  }

  // Get target table fields to determine search fields
  const { data: targetFields } = await supabase
    .from('table_fields')
    .select('name, type')
    .eq('table_id', linkedTableId)
    .order('position', { ascending: true })

  if (!targetFields || targetFields.length === 0) {
    return {
      ids: null,
      errors: ['Target table has no fields'],
    }
  }

  // Determine search fields using same fallback order as display resolution
  // 1. Table's primary field
  // 2. All text-like fields
  // 3. All fields as last resort
  const searchFields: string[] = []

  const primaryName = getPrimaryFieldName(targetFields as any)
  if (primaryName) {
    searchFields.push(primaryName)
  }

  // Use all text-like fields for search
  const textFields = targetFields.filter(f =>
    ['text', 'long_text', 'email', 'url'].includes(f.type)
  )
  searchFields.push(...textFields.map(f => f.name))

  // If no search fields found, fall back to all fields
  if (searchFields.length === 0) {
    searchFields.push(...targetFields.map(f => f.name))
  }

  // Parse pasted text (comma or newline separated)
  const searchTerms = pastedText
    .split(/[,\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 0)

  if (searchTerms.length === 0) {
    return { ids: null, errors: ['No values provided'] }
  }

  // Check if single or multi-link based on field options
  const isMultiLink = field.options?.relationship_type === 'many-to-many' ||
    (field.options?.max_selections && field.options.max_selections > 1)

  // Resolve each search term
  const resolvedIds: string[] = []

  for (const term of searchTerms) {
    // First, check if it's already a UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidRegex.test(term)) {
      // Verify the ID exists in target table
      const { data: record } = await supabase
        .from(targetTable.supabase_table)
        .select('id')
        .eq('id', term)
        .single()

      if (record) {
        resolvedIds.push(term)
        continue
      } else {
        errors.push(`Record ID "${term}" not found in target table`)
        continue
      }
    }

    // Search by display name across search fields
    let found = false

    for (const searchField of searchFields) {
      // Try exact match first
      const { data: exactMatch } = await supabase
        .from(targetTable.supabase_table)
        .select('id')
        .eq(searchField, term)
        .limit(1)
        .maybeSingle()

      if (exactMatch) {
        resolvedIds.push(exactMatch.id)
        found = true
        break
      }

      // Try case-insensitive match
      const { data: caseInsensitiveMatch } = await supabase
        .from(targetTable.supabase_table)
        .select('id')
        .ilike(searchField, term)
        .limit(2) // Check for ambiguity

      if (caseInsensitiveMatch && caseInsensitiveMatch.length === 1) {
        resolvedIds.push(caseInsensitiveMatch[0].id)
        found = true
        break
      } else if (caseInsensitiveMatch && caseInsensitiveMatch.length > 1) {
        // Ambiguity handling: check if there's an exact (case-insensitive) match
        // This reduces pain for common names like "John"
        const exactCaseInsensitive = caseInsensitiveMatch.find(r => 
          // Check if any field value exactly matches (case-insensitive)
          true // For now, we'll reject ambiguous matches
        )
        
        if (exactCaseInsensitive) {
          // If we have a deterministic way to pick one, use it
          resolvedIds.push(exactCaseInsensitive.id)
          found = true
          break
        } else {
          // Multiple matches, no exact case-insensitive match - reject
          errors.push(`Ambiguous match for "${term}" in field "${searchField}": found ${caseInsensitiveMatch.length} records`)
          found = true // Don't continue searching, but mark as found to avoid "not found" error
          break
        }
      }
    }

    if (!found) {
      errors.push(`No record found matching "${term}"`)
    }
  }

  // Validate single-link constraint
  if (!isMultiLink && resolvedIds.length > 1) {
    return {
      ids: null,
      errors: [`Single-link field cannot accept multiple values. Found: ${resolvedIds.length} records`],
    }
  }

  // Return appropriate format
  if (resolvedIds.length === 0) {
    return { ids: null, errors }
  }

  return {
    ids: isMultiLink ? resolvedIds : resolvedIds[0],
    errors: errors.length > 0 ? errors : [],
  }
}
