/**
 * Linked Field Utilities
 * 
 * Helper functions for resolving linked field values between IDs and display names.
 * Used for copy/paste operations where users work with display names but we store IDs.
 */

import { createClient } from '@/lib/supabase/client'
import type { TableField, LinkedField } from '@/types/fields'
import { getPrimaryFieldName } from '@/lib/fields/primary'
import { toPostgrestColumn } from '@/lib/supabase/postgrest'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v)
}

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
    .select('supabase_table, primary_field_name')
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
  const configuredPrimary =
    typeof (targetTable as any)?.primary_field_name === 'string' &&
    String((targetTable as any).primary_field_name).trim().length > 0
      ? String((targetTable as any).primary_field_name).trim()
      : null

  if (configuredPrimary === 'id') {
    displayFieldName = null
  } else if (configuredPrimary) {
    const safe = toPostgrestColumn(configuredPrimary)
    if (safe && targetFields?.some((f: any) => f.name === safe)) {
      displayFieldName = safe
    }
  }

  if (!displayFieldName) {
    displayFieldName = getPrimaryFieldName(targetFields as any)
  }

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

  // Defensive: some legacy data stores display labels instead of UUID ids.
  // Never issue `.in('id', ['Sophie Edgerley'])` against a UUID column (PostgREST 400).
  const uuidIds = validIds.filter(isUuid)
  const legacyValues = validIds.filter((v) => !isUuid(v))

  if (uuidIds.length === 0) {
    // Nothing we can safely resolve; fall back to joining original values.
    return legacyValues.join(', ')
  }

  const { data: records, error: recordsError } = await supabase
    .from(targetTable.supabase_table)
    .select(`id, ${displayFieldName}`)
    .in('id', uuidIds)

  if (recordsError || !records || !Array.isArray(records)) {
    console.warn(`[resolveLinkedFieldDisplay] Error fetching records:`, recordsError)
    return Array.isArray(value) ? value.join(', ') : String(value)
  }

  // Map IDs to display values
  const displayMap = new Map(
    records.map((r: any) => [r.id, r[displayFieldName!] || ''])
  )

  const labels = uuidIds.map(id => displayMap.get(id) || id)
  // Append any legacy (non-UUID) values we couldn't resolve.
  if (legacyValues.length > 0) labels.push(...legacyValues)
  return labels.join(', ')
}

/**
 * Resolve many linked record IDs to a display label map in a batched way.
 *
 * This is useful for features like grouping, where we need stable labels for many IDs
 * without running N individual queries.
 */
export async function resolveLinkedFieldDisplayMap(
  field: LinkedField,
  ids: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>()

  const unique = Array.isArray(ids)
    ? Array.from(new Set(ids.map((v) => String(v ?? '').trim()).filter(Boolean)))
    : []

  if (unique.length === 0) return out

  const linkedTableId = field.options?.linked_table_id
  if (!linkedTableId) {
    for (const id of unique) out.set(id, id)
    return out
  }

  const supabase = createClient()

  const { data: targetTable, error: tableError } = await supabase
    .from('tables')
    .select('supabase_table, primary_field_name')
    .eq('id', linkedTableId)
    .single()

  if (tableError || !targetTable?.supabase_table) {
    for (const id of unique) out.set(id, id)
    return out
  }

  const { data: targetFields } = await supabase
    .from('table_fields')
    .select('id, name, type')
    .eq('table_id', linkedTableId)
    .order('position', { ascending: true })

  const linkedFieldId = field.options?.linked_field_id

  let displayFieldName: string | null = null

  const configuredPrimary =
    typeof (targetTable as any)?.primary_field_name === 'string' &&
    String((targetTable as any).primary_field_name).trim().length > 0
      ? String((targetTable as any).primary_field_name).trim()
      : null

  if (configuredPrimary === 'id') {
    displayFieldName = null
  } else if (configuredPrimary) {
    const safe = toPostgrestColumn(configuredPrimary)
    if (safe && targetFields?.some((f: any) => f.name === safe)) {
      displayFieldName = safe
    }
  }

  if (!displayFieldName) {
    displayFieldName = getPrimaryFieldName(targetFields as any)
  }

  if (!displayFieldName && linkedFieldId && targetFields) {
    const linkedField = (targetFields as any[]).find((f) => f.id === linkedFieldId || f.name === linkedFieldId)
    if (linkedField) displayFieldName = String(linkedField.name)
  }

  if (!displayFieldName && targetFields) {
    const textField = (targetFields as any[]).find((f) => ['text', 'long_text', 'email', 'url'].includes(String(f.type)))
    if (textField) displayFieldName = String(textField.name)
  }

  if (!displayFieldName) {
    for (const id of unique) out.set(id, id)
    return out
  }

  const uuidIds = unique.filter(isUuid)
  const legacyValues = unique.filter((v) => !isUuid(v))

  // Always include legacy values as-is.
  for (const v of legacyValues) out.set(v, v)

  if (uuidIds.length === 0) return out

  // Chunk queries to keep the `in()` list to a reasonable size.
  const chunkSize = 200
  for (let i = 0; i < uuidIds.length; i += chunkSize) {
    const chunk = uuidIds.slice(i, i + chunkSize)
    const { data: records, error: recordsError } = await supabase
      .from(targetTable.supabase_table)
      .select(`id, ${displayFieldName}`)
      .in('id', chunk)

    if (recordsError || !Array.isArray(records)) {
      // Fallback: keep IDs as labels if query fails.
      for (const id of chunk) if (!out.has(id)) out.set(id, id)
      continue
    }

    for (const r of records as any[]) {
      const id = String(r?.id ?? '')
      if (!id) continue
      const label = r?.[displayFieldName] != null ? String(r[displayFieldName]) : ''
      out.set(id, label || id)
    }

    // Ensure any missing IDs still get a fallback label.
    for (const id of chunk) if (!out.has(id)) out.set(id, id)
  }

  return out
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

/**
 * Sync a linked field update bidirectionally to its reciprocal field.
 * 
 * When a linked field is updated, this function ensures the reciprocal field
 * in the linked table is also updated to maintain bidirectional consistency.
 * 
 * @param sourceTableId - ID of the table containing the source field
 * @param sourceTableName - Physical table name (supabase_table) of source table
 * @param sourceFieldName - Name of the source field that was updated
 * @param sourceRecordId - ID of the record that was updated
 * @param newValue - New value set in the source field (string, string[], or null)
 * @param oldValue - Previous value in the source field (string, string[], or null)
 * @param skipSync - Guard flag to prevent infinite loops (set to true when called from reciprocal sync)
 * @returns Promise that resolves when sync is complete
 */
export async function syncLinkedFieldBidirectional(
  sourceTableId: string,
  sourceTableName: string,
  sourceFieldName: string,
  sourceRecordId: string,
  newValue: string | string[] | null,
  oldValue: string | string[] | null,
  skipSync: boolean = false
): Promise<void> {
  // Prevent infinite loops
  if (skipSync) {
    return
  }

  if (!isUuid(sourceRecordId)) {
    console.warn('[syncLinkedFieldBidirectional] Invalid source record ID:', sourceRecordId)
    return
  }

  const supabase = createClient()

  // Fetch source field metadata
  const { data: sourceField, error: sourceFieldError } = await supabase
    .from('table_fields')
    .select('id, name, type, options')
    .eq('table_id', sourceTableId)
    .eq('name', sourceFieldName)
    .single()

  if (sourceFieldError || !sourceField) {
    console.warn('[syncLinkedFieldBidirectional] Source field not found:', sourceFieldName)
    return
  }

  if (sourceField.type !== 'link_to_table') {
    // Not a linked field, nothing to sync
    return
  }

  const sourceOptions = (sourceField.options || {}) as any
  const linkedTableId = sourceOptions?.linked_table_id
  const linkedFieldId = sourceOptions?.linked_field_id

  if (!linkedTableId) {
    // No target table configured
    return
  }

  if (!linkedFieldId) {
    // No reciprocal field configured - this is a one-way link
    return
  }

  // Fetch reciprocal field metadata
  const { data: reciprocalField, error: reciprocalFieldError } = await supabase
    .from('table_fields')
    .select('id, name, type, options, table_id')
    .eq('id', linkedFieldId)
    .single()

  if (reciprocalFieldError || !reciprocalField) {
    console.warn('[syncLinkedFieldBidirectional] Reciprocal field not found:', linkedFieldId)
    return
  }

  if (reciprocalField.type !== 'link_to_table') {
    console.warn('[syncLinkedFieldBidirectional] Reciprocal field is not a link_to_table field')
    return
  }

  // Get target table info
  const { data: targetTable, error: targetTableError } = await supabase
    .from('tables')
    .select('id, supabase_table')
    .eq('id', linkedTableId)
    .single()

  if (targetTableError || !targetTable) {
    console.warn('[syncLinkedFieldBidirectional] Target table not found:', linkedTableId)
    return
  }

  const reciprocalOptions = (reciprocalField.options || {}) as any
  const reciprocalFieldName = reciprocalField.name
  const targetTableName = targetTable.supabase_table

  // Determine if multi-link based on source field options
  const sourceIsMulti = 
    sourceOptions?.relationship_type === 'one-to-many' ||
    sourceOptions?.relationship_type === 'many-to-many' ||
    (typeof sourceOptions?.max_selections === 'number' && sourceOptions.max_selections > 1)

  // Normalize values to arrays for processing
  const normalizeToArray = (val: string | string[] | null): string[] => {
    if (val === null || val === undefined) return []
    if (Array.isArray(val)) return val.filter(isUuid)
    if (isUuid(val)) return [val]
    return []
  }

  const oldIds = normalizeToArray(oldValue)
  const newIds = normalizeToArray(newValue)

  // Calculate which records need to be updated
  const addedIds = newIds.filter(id => !oldIds.includes(id))
  const removedIds = oldIds.filter(id => !newIds.includes(id))

  if (addedIds.length === 0 && removedIds.length === 0) {
    // No changes to sync
    return
  }

  if (sourceIsMulti) {
    // Multi-link: Update arrays in target records
    // For each added ID, add sourceRecordId to that target record's reciprocal array
    // For each removed ID, remove sourceRecordId from that target record's reciprocal array

    // Handle additions
    if (addedIds.length > 0) {
      for (const targetRecordId of addedIds) {
        if (!isUuid(targetRecordId)) continue

        // Get current value of reciprocal field
        const { data: targetRecord, error: fetchError } = await supabase
          .from(targetTableName)
          .select(`id, ${reciprocalFieldName}`)
          .eq('id', targetRecordId)
          .single()

        if (fetchError || !targetRecord) {
          console.warn(`[syncLinkedFieldBidirectional] Target record not found: ${targetRecordId}`)
          continue
        }

        const currentValue = targetRecord[reciprocalFieldName]
        const currentArray = normalizeToArray(currentValue)

        // Add sourceRecordId if not already present
        if (!currentArray.includes(sourceRecordId)) {
          const updatedArray = [...currentArray, sourceRecordId]

          const { error: updateError } = await supabase
            .from(targetTableName)
            .update({ [reciprocalFieldName]: updatedArray })
            .eq('id', targetRecordId)

          if (updateError) {
            console.error(`[syncLinkedFieldBidirectional] Failed to update reciprocal for record ${targetRecordId}:`, updateError)
          }
        }
      }
    }

    // Handle removals
    if (removedIds.length > 0) {
      for (const targetRecordId of removedIds) {
        if (!isUuid(targetRecordId)) continue

        // Get current value of reciprocal field
        const { data: targetRecord, error: fetchError } = await supabase
          .from(targetTableName)
          .select(`id, ${reciprocalFieldName}`)
          .eq('id', targetRecordId)
          .single()

        if (fetchError || !targetRecord) {
          continue
        }

        const currentValue = targetRecord[reciprocalFieldName]
        const currentArray = normalizeToArray(currentValue)

        // Remove sourceRecordId if present
        if (currentArray.includes(sourceRecordId)) {
          const updatedArray = currentArray.filter(id => id !== sourceRecordId)

          const { error: updateError } = await supabase
            .from(targetTableName)
            .update({ [reciprocalFieldName]: updatedArray.length > 0 ? updatedArray : null })
            .eq('id', targetRecordId)

          if (updateError) {
            console.error(`[syncLinkedFieldBidirectional] Failed to update reciprocal for record ${targetRecordId}:`, updateError)
          }
        }
      }
    }
  } else {
    // Single-link: Set reciprocal to point back to source record
    // If newValue is set, update the target record's reciprocal to sourceRecordId
    // If newValue is null, clear the old target record's reciprocal

    if (newValue && isUuid(newValue as string)) {
      // Set reciprocal in new target record
      const { error: updateError } = await supabase
        .from(targetTableName)
        .update({ [reciprocalFieldName]: sourceRecordId })
        .eq('id', newValue as string)

      if (updateError) {
        console.error(`[syncLinkedFieldBidirectional] Failed to update reciprocal for record ${newValue}:`, updateError)
      }
    }

    // Clear reciprocal in old target record (if different from new)
    if (oldValue && isUuid(oldValue as string) && oldValue !== newValue) {
      const { error: updateError } = await supabase
        .from(targetTableName)
        .update({ [reciprocalFieldName]: null })
        .eq('id', oldValue as string)

      if (updateError) {
        console.error(`[syncLinkedFieldBidirectional] Failed to clear reciprocal for record ${oldValue}:`, updateError)
      }
    }
  }
}
