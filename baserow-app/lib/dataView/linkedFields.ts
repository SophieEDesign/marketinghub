/**
 * Linked Field Utilities
 *
 * Helper functions for resolving linked field values between IDs and display names.
 * Used for copy/paste operations where users work with display names but we store IDs.
 */

import { createClient } from '@/lib/supabase/client'
import type { FieldOptions, LinkedField, TableField } from '@/types/fields'
import { getPrimaryFieldName } from '@/lib/fields/primary'
import { toPostgrestColumn } from '@/lib/supabase/postgrest'

/** Row shape from tables select (supabase_table, primary_field_name). */
export interface TargetTableRow {
  supabase_table: string
  primary_field_name?: string | null
}

/** Row shape from table_fields select (id, name, type). */
export interface TargetFieldRow {
  id: string
  name: string
  type: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v)
}

interface LinkedTableMetadata {
  table: TargetTableRow
  fields: TargetFieldRow[]
}

const linkedTableMetaCache = new Map<
  string,
  { data: LinkedTableMetadata | null; promise: Promise<LinkedTableMetadata | null> | null }
>()

/**
 * Load and cache basic metadata for a linked table (Supabase physical table name + fields).
 *
 * This function is intentionally shared across all linked-field helpers to avoid
 * issuing repeated `/tables?select=supabase_table,primary_field_name` and
 * `/table_fields` requests for the same linked_table_id.
 */
export async function getLinkedTableMetadataCached(
  linkedTableId: string
): Promise<LinkedTableMetadata | null> {
  const existing = linkedTableMetaCache.get(linkedTableId)
  if (existing?.data) {
    return existing.data
  }
  if (existing?.promise) {
    return existing.promise
  }

  const supabase = createClient()

  const promise: Promise<LinkedTableMetadata | null> = (async () => {
    const { data: targetTable, error: tableError } = await supabase
      .from('tables')
      .select('supabase_table, primary_field_name')
      .eq('id', linkedTableId)
      .single()

    if (tableError || !targetTable?.supabase_table) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[linkedFields] Target table not found for linked field', {
          linkedTableId,
          error: tableError,
        })
      }
      linkedTableMetaCache.set(linkedTableId, { data: null, promise: null })
      return null
    }

    const tableRow: TargetTableRow = {
      supabase_table: targetTable.supabase_table,
      primary_field_name: targetTable.primary_field_name ?? null,
    }

    const { data: targetFields } = await supabase
      .from('table_fields')
      .select('id, name, type')
      .eq('table_id', linkedTableId)
      .order('position', { ascending: true })

    const fieldRows: TargetFieldRow[] = Array.isArray(targetFields) ? targetFields : []

    const meta: LinkedTableMetadata = { table: tableRow, fields: fieldRows }
    linkedTableMetaCache.set(linkedTableId, { data: meta, promise: null })
    return meta
  })().catch((err) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[linkedFields] Failed to load linked table metadata', {
        linkedTableId,
        error: err,
      })
    }
    // On failure, clear the promise entry so a future attempt can retry.
    linkedTableMetaCache.delete(linkedTableId)
    return null
  })

  linkedTableMetaCache.set(linkedTableId, { data: null, promise })
  return promise
}

/**
 * Determine which field name to use for display labels for a linked table.
 * Fallback order: 1) table primary field, 2) linked_field_id, 3) first text-like field, 4) null (use IDs).
 */
export function getDisplayFieldNameForLinkedTable(params: {
  targetTable: TargetTableRow
  targetFields: TargetFieldRow[] | null
  linkedFieldId?: string | null
}): string | null {
  const { targetTable, targetFields, linkedFieldId } = params
  let displayFieldName: string | null = null

  const configuredPrimary =
    typeof targetTable.primary_field_name === 'string' &&
    String(targetTable.primary_field_name).trim().length > 0
      ? String(targetTable.primary_field_name).trim()
      : null

  if (configuredPrimary === 'id') {
    displayFieldName = null
  } else if (configuredPrimary && targetFields) {
    const safe = toPostgrestColumn(configuredPrimary)
    if (safe && targetFields.some((f) => f.name === safe)) {
      displayFieldName = safe
    }
  }

  if (!displayFieldName && targetFields) {
    const asTableFields: TableField[] = targetFields.map((f) => ({
      ...f,
      type: f.type as TableField['type'],
      table_id: '',
      position: 0,
      created_at: '',
    }))
    displayFieldName = getPrimaryFieldName(asTableFields)
  }

  if (!displayFieldName && linkedFieldId && targetFields) {
    const linkedField = targetFields.find(
      (f) => f.id === linkedFieldId || f.name === linkedFieldId
    )
    if (linkedField) {
      displayFieldName = linkedField.name
    }
  }

  if (!displayFieldName && targetFields) {
    const textField = targetFields.find((f) =>
      ['text', 'long_text', 'email', 'url'].includes(f.type)
    )
    if (textField) {
      displayFieldName = textField.name
    }
  }

  return displayFieldName
}

/** Field row from table_fields used in sync (id, name, type, options, table_id). */
interface LinkFieldRow {
  id: string
  name: string
  type: string
  options?: FieldOptions | null
  table_id: string
}

/** Table row from tables used in sync (id, supabase_table). */
interface TableRowForSync {
  id: string
  supabase_table: string
}

/**
 * Safely read a linked-field value from a record (string, string[], or null).
 * Used when reading from Supabase select to avoid any-typed access.
 */
function getLinkedFieldValueFromRecord(
  record: Record<string, unknown>,
  fieldName: string
): string | string[] | null {
  const v = record[fieldName]
  if (v === null || v === undefined) return null
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v
  return null
}

/**
 * Canonical stored value for a linked field: single ID, multiple IDs, or empty.
 * Row data may also contain legacy/UI shapes (e.g. { id: string } or mixed arrays);
 * use getLinkedFieldValueFromRow to normalize for resolution.
 */
export type LinkedFieldStoredValue = string | string[] | null

/**
 * Read and normalize a linked field value from a row (by field name or id).
 * Handles stored shape (string | string[]), legacy/UI shapes (object with id, or array of same).
 * Supports both row shapes: row.data[fieldName] or flat row[fieldName].
 * Returns null when missing or empty.
 */
export function getLinkedFieldValueFromRow(
  row: { data?: Record<string, unknown> } & Record<string, unknown>,
  field: LinkedField
): LinkedFieldStoredValue | null {
  const data = row.data ?? row
  const raw =
    data[field.name] ??
    (field.id ? data[field.id] : undefined)

  if (raw === null || raw === undefined) {
    return null
  }

  if (typeof raw === 'string') {
    const s = raw.trim()
    return s.length > 0 ? s : null
  }

  if (Array.isArray(raw)) {
    const ids: string[] = []
    for (const v of raw) {
      if (typeof v === 'string' && v.trim()) {
        ids.push(v.trim())
      } else if (v && typeof v === 'object' && 'id' in v && v.id != null) {
        ids.push(String(v.id))
      }
    }
    if (ids.length === 0) return null
    return ids
  }

  if (typeof raw === 'object' && raw !== null && 'id' in raw && raw.id != null) {
    return String(raw.id)
  }

  return null
}

/**
 * Flatten a stored linked value to an array of ID strings for resolution.
 */
export function linkedValueToIds(value: LinkedFieldStoredValue | null): string[] {
  if (value == null) return []
  if (Array.isArray(value)) return value.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
  const s = typeof value === 'string' ? value.trim() : ''
  return s ? [s] : []
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

  const meta = await getLinkedTableMetadataCached(linkedTableId)
  if (!meta) {
    return String(value)
  }

  const { table: tableRow, fields: fieldRows } = meta

  const displayFieldName = getDisplayFieldNameForLinkedTable({
    targetTable: tableRow,
    targetFields: fieldRows.length > 0 ? fieldRows : null,
    linkedFieldId: field.options?.linked_field_id ?? null,
  })

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

  const supabase = createClient()

  const { data: records, error: recordsError } = await supabase
    .from(tableRow.supabase_table)
    .select(`id, ${displayFieldName}`)
    .in('id', uuidIds)

  if (recordsError || !records || !Array.isArray(records)) {
    console.warn(`[resolveLinkedFieldDisplay] Error fetching records:`, recordsError)
    return Array.isArray(value) ? value.join(', ') : String(value)
  }

  const displayMap = new Map<string, string>()
  for (const r of records as unknown as Record<string, unknown>[]) {
    const id = r?.id != null ? String(r.id) : ''
    if (!id) continue
    const label = r[displayFieldName] != null ? String(r[displayFieldName]) : ''
    displayMap.set(id, label || '')
  }

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

  const meta = await getLinkedTableMetadataCached(linkedTableId)
  if (!meta || !meta.table.supabase_table) {
    for (const id of unique) out.set(id, id)
    return out
  }

  const { table: tableRow, fields: fieldRows } = meta

  const displayFieldName = getDisplayFieldNameForLinkedTable({
    targetTable: tableRow,
    targetFields: fieldRows.length > 0 ? fieldRows : null,
    linkedFieldId: field.options?.linked_field_id ?? null,
  })

  if (!displayFieldName) {
    for (const id of unique) out.set(id, id)
    return out
  }

  const uuidIds = unique.filter(isUuid)
  const legacyValues = unique.filter((v) => !isUuid(v))

  // Always include legacy values as-is.
  for (const v of legacyValues) out.set(v, v)

  const supabase = createClient()

  if (uuidIds.length === 0) return out

  // Chunk queries to keep the `in()` list to a reasonable size.
  const chunkSize = 200
  for (let i = 0; i < uuidIds.length; i += chunkSize) {
    const chunk = uuidIds.slice(i, i + chunkSize)
    const { data: records, error: recordsError } = await supabase
      .from(tableRow.supabase_table)
      .select(`id, ${displayFieldName}`)
      .in('id', chunk)

    if (recordsError || !Array.isArray(records)) {
      for (const id of chunk) if (!out.has(id)) out.set(id, id)
      continue
    }

    for (const r of records as unknown as Record<string, unknown>[]) {
      const id = r?.id != null ? String(r.id) : ''
      if (!id) continue
      const label = r[displayFieldName] != null ? String(r[displayFieldName]) : ''
      out.set(id, label || id)
      if (isUuid(id)) out.set(id.toLowerCase(), label || id)
    }

    // Ensure any missing IDs still get a fallback label.
    for (const id of chunk) {
      if (!out.has(id)) out.set(id, id)
      if (isUuid(id) && !out.has(id.toLowerCase())) out.set(id.toLowerCase(), id)
    }
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

  const meta = await getLinkedTableMetadataCached(linkedTableId)

  if (!meta) {
    return {
      ids: null,
      errors: [`Target table not found: ${linkedTableId}`],
    }
  }

  const { table: tableRow, fields: fieldRows } = meta

  if (fieldRows.length === 0) {
    return {
      ids: null,
      errors: ['Target table has no fields'],
    }
  }

  const displayFieldName = getDisplayFieldNameForLinkedTable({
    targetTable: tableRow,
    targetFields: fieldRows,
    linkedFieldId: field.options?.linked_field_id ?? null,
  })

  const searchFields: string[] = []
  if (displayFieldName) {
    searchFields.push(displayFieldName)
  }
  const textFields = fieldRows.filter((f) =>
    ['text', 'long_text', 'email', 'url'].includes(f.type)
  )
  for (const f of textFields) {
    if (!searchFields.includes(f.name)) searchFields.push(f.name)
  }
  if (searchFields.length === 0) {
    searchFields.push(...fieldRows.map((f) => f.name))
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

  const supabase = createClient()

  for (const term of searchTerms) {
    if (isUuid(term)) {
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
 * Works in both directions:
 * - Source field updated → syncs to reciprocal field
 * - Reciprocal field updated → syncs back to source field
 * 
 * @param sourceTableId - ID of the table containing the field that was updated
 * @param sourceTableName - Physical table name (supabase_table) of the table containing the updated field
 * @param sourceFieldName - Name of the field that was updated
 * @param sourceRecordId - ID of the record that was updated
 * @param newValue - New value set in the field (string, string[], or null)
 * @param oldValue - Previous value in the field (string, string[], or null)
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

  // Fetch the field that was updated
  const { data: updatedField, error: fieldError } = await supabase
    .from('table_fields')
    .select('id, name, type, options, table_id')
    .eq('table_id', sourceTableId)
    .eq('name', sourceFieldName)
    .single()

  if (fieldError || !updatedField) {
    console.warn('[syncLinkedFieldBidirectional] Field not found:', sourceFieldName)
    return
  }

  if (updatedField.type !== 'link_to_table') {
    return
  }

  const updatedFieldOptions: FieldOptions = (updatedField.options || {}) as FieldOptions
  const linkedFieldId = updatedFieldOptions?.linked_field_id

  let isReciprocalField = false
  let sourceField: LinkFieldRow
  let reciprocalField: LinkFieldRow
  let sourceTableName_final: string
  let targetTableName: string
  let sourceFieldName_final: string
  let reciprocalFieldName: string

  if (linkedFieldId) {
    isReciprocalField = true
    reciprocalField = updatedField as LinkFieldRow

    const { data: sourceFieldData, error: sourceFieldError } = await supabase
      .from('table_fields')
      .select('id, name, type, options, table_id')
      .eq('id', linkedFieldId)
      .single()

    if (sourceFieldError || !sourceFieldData) {
      console.warn('[syncLinkedFieldBidirectional] Source field not found for reciprocal:', linkedFieldId)
      return
    }

    if (sourceFieldData.type !== 'link_to_table') {
      console.warn('[syncLinkedFieldBidirectional] Source field is not a link_to_table field')
      return
    }

    sourceField = sourceFieldData as LinkFieldRow
    const sourceFieldOptions: FieldOptions = (sourceField.options || {}) as FieldOptions
    const sourceTableId_final = sourceField.table_id
    const targetTableId = sourceFieldOptions?.linked_table_id

    if (!targetTableId || typeof targetTableId !== 'string') {
      console.warn('[syncLinkedFieldBidirectional] Source field has no linked_table_id')
      return
    }

    const { data: sourceTableData, error: sourceTableError } = await supabase
      .from('tables')
      .select('id, supabase_table')
      .eq('id', sourceTableId_final)
      .single()

    const { data: targetTableData, error: targetTableError } = await supabase
      .from('tables')
      .select('id, supabase_table')
      .eq('id', targetTableId)
      .single()

    if (sourceTableError || !sourceTableData || targetTableError || !targetTableData) {
      console.warn('[syncLinkedFieldBidirectional] Table not found')
      return
    }

    const sourceTable = sourceTableData as TableRowForSync
    const targetTable = targetTableData as TableRowForSync
    sourceFieldName_final = sourceField.name
    reciprocalFieldName = reciprocalField.name
    sourceTableName_final = sourceTable.supabase_table
    targetTableName = targetTable.supabase_table
  } else {
    isReciprocalField = false
    sourceField = updatedField as LinkFieldRow
    const sourceFieldOptions: FieldOptions = (sourceField.options || {}) as FieldOptions
    const linkedTableId = sourceFieldOptions?.linked_table_id

    if (!linkedTableId) {
      return
    }

    if (!linkedFieldId) {
      return
    }

    const { data: reciprocalFieldData, error: reciprocalFieldError } = await supabase
      .from('table_fields')
      .select('id, name, type, options, table_id')
      .eq('id', linkedFieldId)
      .single()

    if (reciprocalFieldError || !reciprocalFieldData) {
      console.warn('[syncLinkedFieldBidirectional] Reciprocal field not found:', linkedFieldId)
      return
    }

    if (reciprocalFieldData.type !== 'link_to_table') {
      console.warn('[syncLinkedFieldBidirectional] Reciprocal field is not a link_to_table field')
      return
    }

    reciprocalField = reciprocalFieldData as LinkFieldRow

    const { data: targetTableData, error: targetTableError } = await supabase
      .from('tables')
      .select('id, supabase_table')
      .eq('id', linkedTableId)
      .single()

    if (targetTableError || !targetTableData) {
      console.warn('[syncLinkedFieldBidirectional] Target table not found:', linkedTableId)
      return
    }

    const targetTable = targetTableData as TableRowForSync
    sourceFieldName_final = sourceField.name
    reciprocalFieldName = reciprocalField.name
    sourceTableName_final = sourceTableName
    targetTableName = targetTable.supabase_table
  }

  const sourceFieldOptions: FieldOptions = (sourceField.options || {}) as FieldOptions
  const sourceIsMulti = 
    sourceFieldOptions?.relationship_type === 'one-to-many' ||
    sourceFieldOptions?.relationship_type === 'many-to-many' ||
    (typeof sourceFieldOptions?.max_selections === 'number' && sourceFieldOptions.max_selections > 1)

  // Normalize values to arrays for processing
  const normalizeToArray = (val: string | string[] | null): string[] => {
    if (val === null || val === undefined) return []
    if (Array.isArray(val)) return val.filter(isUuid)
    if (typeof val === 'string') {
      if (isUuid(val)) return [val]
      // Handle stringified arrays (e.g., "["uuid"]" from database)
      const strVal: string = val
      const trimmed = strVal.trim()
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(strVal)
          if (Array.isArray(parsed)) {
            return parsed.filter(isUuid)
          }
        } catch {
          // Not valid JSON, fall through
        }
      }
    }
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

  if (isReciprocalField) {
    // REVERSE SYNC: Reciprocal field was updated → sync back to source field
    // sourceRecordId is in targetTable, newValue/oldValue are source record IDs
    // We need to update sourceTable records

    if (sourceIsMulti) {
      // Multi-link reverse: Update source records' source field arrays
      // For each added source ID, add sourceRecordId to that source record's source field array
      // For each removed source ID, remove sourceRecordId from that source record's source field array

      // Handle additions
      if (addedIds.length > 0) {
        for (const sourceRecordIdToUpdate of addedIds) {
          if (!isUuid(sourceRecordIdToUpdate)) continue

          // Get current value of source field
          const { data: sourceRecord, error: fetchError } = await supabase
            .from(sourceTableName_final)
            .select(`id, ${sourceFieldName_final}`)
            .eq('id', sourceRecordIdToUpdate)
            .single()

          if (fetchError || !sourceRecord) {
            console.warn(`[syncLinkedFieldBidirectional] Source record not found: ${sourceRecordIdToUpdate}`)
            continue
          }

          const currentValue = getLinkedFieldValueFromRecord(
            sourceRecord as unknown as Record<string, unknown>,
            sourceFieldName_final
          )
          const currentArray = normalizeToArray(currentValue)

          // Add sourceRecordId (from target table) if not already present
          if (!currentArray.includes(sourceRecordId)) {
            const updatedArray = [...currentArray, sourceRecordId]

            // Ensure we're sending a proper array, not a stringified version
            // Check if the column type supports arrays, if not we need to handle it differently
            const { error: updateError } = await supabase
              .from(sourceTableName_final)
              .update({ [sourceFieldName_final]: updatedArray })
              .eq('id', sourceRecordIdToUpdate)

            if (updateError) {
              // If we get a type error, the column might be uuid instead of uuid[]
              // In that case, we can't update it as an array - log and skip
              if (updateError.code === '22P02' && String(updateError.message || '').toLowerCase().includes('invalid input syntax for type uuid')) {
                console.warn(`[syncLinkedFieldBidirectional] Column ${sourceFieldName_final} is uuid (not uuid[]), cannot sync multi-link bidirectionally. Field needs to be migrated to uuid[] first.`)
              } else {
                console.error(`[syncLinkedFieldBidirectional] Failed to update source field for record ${sourceRecordIdToUpdate}:`, updateError)
              }
            }
          }
        }
      }

      // Handle removals
      if (removedIds.length > 0) {
        for (const sourceRecordIdToUpdate of removedIds) {
          if (!isUuid(sourceRecordIdToUpdate)) continue

          // Get current value of source field
          const { data: sourceRecord, error: fetchError } = await supabase
            .from(sourceTableName_final)
            .select(`id, ${sourceFieldName_final}`)
            .eq('id', sourceRecordIdToUpdate)
            .single()

          if (fetchError || !sourceRecord) {
            continue
          }

          const currentValue = getLinkedFieldValueFromRecord(
            sourceRecord as unknown as Record<string, unknown>,
            sourceFieldName_final
          )
          const currentArray = normalizeToArray(currentValue)

          // Remove sourceRecordId (from target table) if present
          if (currentArray.includes(sourceRecordId)) {
            const updatedArray = currentArray.filter(id => id !== sourceRecordId)

            // Ensure we're sending a proper array, not a stringified version
            const { error: updateError } = await supabase
              .from(sourceTableName_final)
              .update({ [sourceFieldName_final]: updatedArray.length > 0 ? updatedArray : null })
              .eq('id', sourceRecordIdToUpdate)

            if (updateError) {
              // If we get a type error, the column might be uuid instead of uuid[]
              if (updateError.code === '22P02' && String(updateError.message || '').toLowerCase().includes('invalid input syntax for type uuid')) {
                console.warn(`[syncLinkedFieldBidirectional] Column ${sourceFieldName_final} is uuid (not uuid[]), cannot sync multi-link bidirectionally. Field needs to be migrated to uuid[] first.`)
              } else {
                console.error(`[syncLinkedFieldBidirectional] Failed to update source field for record ${sourceRecordIdToUpdate}:`, updateError)
              }
            }
          }
        }
      }
    } else {
      // Single-link reverse: Update source record's source field to point to sourceRecordId (in target table)
      // If newValue is set, update the source record's source field to sourceRecordId
      // If newValue is null, clear the old source record's source field

      if (newValue && isUuid(newValue as string)) {
        // Set source field in new source record to point to sourceRecordId (in target table)
        const { error: updateError } = await supabase
          .from(sourceTableName_final)
          .update({ [sourceFieldName_final]: sourceRecordId })
          .eq('id', newValue as string)

        if (updateError) {
          console.error(`[syncLinkedFieldBidirectional] Failed to update source field for record ${newValue}:`, updateError)
        }
      }

      // Clear source field in old source record (if different from new)
      if (oldValue && isUuid(oldValue as string) && oldValue !== newValue) {
        const { error: updateError } = await supabase
          .from(sourceTableName_final)
          .update({ [sourceFieldName_final]: null })
          .eq('id', oldValue as string)

        if (updateError) {
          console.error(`[syncLinkedFieldBidirectional] Failed to clear source field for record ${oldValue}:`, updateError)
        }
      }
    }
  } else {
    // FORWARD SYNC: Source field was updated → sync to reciprocal field
    // sourceRecordId is in sourceTable, newValue/oldValue are target record IDs
    // We need to update targetTable records

    if (sourceIsMulti) {
      // Multi-link forward: Update target records' reciprocal field arrays
      // For each added target ID, add sourceRecordId to that target record's reciprocal array
      // For each removed target ID, remove sourceRecordId from that target record's reciprocal array

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

          const currentValue = getLinkedFieldValueFromRecord(
            targetRecord as unknown as Record<string, unknown>,
            reciprocalFieldName
          )
          const currentArray = normalizeToArray(currentValue)

          // Add sourceRecordId if not already present
          if (!currentArray.includes(sourceRecordId)) {
            const updatedArray = [...currentArray, sourceRecordId]

            // Ensure we're sending a proper array, not a stringified version
            const { error: updateError } = await supabase
              .from(targetTableName)
              .update({ [reciprocalFieldName]: updatedArray })
              .eq('id', targetRecordId)

            if (updateError) {
              // If we get a type error, the column might be uuid instead of uuid[]
              if (updateError.code === '22P02' && String(updateError.message || '').toLowerCase().includes('invalid input syntax for type uuid')) {
                console.warn(`[syncLinkedFieldBidirectional] Column ${reciprocalFieldName} is uuid (not uuid[]), cannot sync multi-link bidirectionally. Field needs to be migrated to uuid[] first.`)
              } else {
                console.error(`[syncLinkedFieldBidirectional] Failed to update reciprocal for record ${targetRecordId}:`, updateError)
              }
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

          const currentValue = getLinkedFieldValueFromRecord(
            targetRecord as unknown as Record<string, unknown>,
            reciprocalFieldName
          )
          const currentArray = normalizeToArray(currentValue)

          // Remove sourceRecordId if present
          if (currentArray.includes(sourceRecordId)) {
            const updatedArray = currentArray.filter(id => id !== sourceRecordId)

            // Ensure we're sending a proper array, not a stringified version
            const { error: updateError } = await supabase
              .from(targetTableName)
              .update({ [reciprocalFieldName]: updatedArray.length > 0 ? updatedArray : null })
              .eq('id', targetRecordId)

            if (updateError) {
              // If we get a type error, the column might be uuid instead of uuid[]
              if (updateError.code === '22P02' && String(updateError.message || '').toLowerCase().includes('invalid input syntax for type uuid')) {
                console.warn(`[syncLinkedFieldBidirectional] Column ${reciprocalFieldName} is uuid (not uuid[]), cannot sync multi-link bidirectionally. Field needs to be migrated to uuid[] first.`)
              } else {
                console.error(`[syncLinkedFieldBidirectional] Failed to update reciprocal for record ${targetRecordId}:`, updateError)
              }
            }
          }
        }
      }
    } else {
      // Single-link forward: Set reciprocal to point back to source record
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
}
