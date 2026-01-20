/**
 * Repair (historic) linked fields to be bidirectional.
 *
 * What it does:
 * - Finds `table_fields` with type `link_to_table`
 * - Ensures a reciprocal link field exists in the target table
 * - Ensures both sides' `options.linked_field_id` point to each other
 * - Ensures `view_fields` rows exist so the columns show in views
 * - Optionally backfills reciprocal column values based on existing data
 *
 * Usage:
 * - Dry run (recommended first):
 *   npx tsx scripts/repair-linked-fields.ts --dry-run
 *
 * - Apply changes:
 *   npx tsx scripts/repair-linked-fields.ts
 *
 * Env required:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js'

type Json = any

type TableRow = {
  id: string
  name?: string | null
  supabase_table: string
}

type TableFieldRow = {
  id: string
  table_id: string
  name: string
  label?: string | null
  type: string
  position: number | null
  order_index?: number | null
  options?: Json | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v)
}

function asArray<T = any>(v: any): T[] {
  if (v == null) return []
  return Array.isArray(v) ? v : [v]
}

function uniq<T>(arr: T[]): T[] {
  const seen = new Set<any>()
  const out: T[] = []
  for (const x of arr) {
    if (seen.has(x)) continue
    seen.add(x)
    out.push(x)
  }
  return out
}

function sanitizeFieldName(name: string): string {
  return String(name ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 63)
}

function quoteIdent(ident: string): string {
  return `"${String(ident ?? '').replace(/"/g, '""')}"`
}

function quoteMaybeQualifiedName(name: string): string {
  const raw = String(name ?? '')
  const parts = raw.split('.')
  if (parts.length === 2 && parts[0] && parts[1]) {
    return `${quoteIdent(parts[0])}.${quoteIdent(parts[1])}`
  }
  return quoteIdent(raw)
}

function isMultiLink(options: any): boolean {
  const relationshipType = options?.relationship_type
  const maxSelections = options?.max_selections
  return (
    relationshipType === 'one-to-many' ||
    relationshipType === 'many-to-many' ||
    (typeof maxSelections === 'number' && maxSelections > 1)
  )
}

function parseArgs(argv: string[]) {
  const args = new Set(argv)
  return {
    dryRun: args.has('--dry-run') || args.has('-n'),
    noBackfill: args.has('--no-backfill'),
    limit: (() => {
      const idx = argv.findIndex((a) => a === '--limit')
      if (idx === -1) return null
      const raw = argv[idx + 1]
      const n = Number(raw)
      return Number.isFinite(n) && n > 0 ? n : null
    })(),
  }
}

async function main() {
  const { dryRun, noBackfill, limit } = parseArgs(process.argv.slice(2))

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not set')
    process.exit(1)
  }
  if (!supabaseServiceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not set')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log(`🔧 Repair linked fields (dryRun=${dryRun}, backfill=${!noBackfill})`)

  // Load all tables (for name + supabase_table lookup)
  const { data: tables, error: tablesError } = await supabase
    .from('tables')
    .select('id, name, supabase_table')

  if (tablesError) {
    console.error('❌ Failed to load tables:', tablesError)
    process.exit(1)
  }

  const tableById = new Map<string, TableRow>()
  for (const t of (tables || []) as any[]) {
    if (t?.id && t?.supabase_table) tableById.set(t.id, t as TableRow)
  }

  // Fetch link fields in pages to avoid PostgREST limits.
  const linkFields: TableFieldRow[] = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1
    const { data, error } = await supabase
      .from('table_fields')
      .select('id, table_id, name, label, type, position, order_index, options')
      .eq('type', 'link_to_table')
      .order('created_at', { ascending: true })
      .range(from, to)

    if (error) {
      console.error('❌ Failed to load link fields:', error)
      process.exit(1)
    }
    const rows = (data || []) as TableFieldRow[]
    linkFields.push(...rows)
    if (rows.length < pageSize) break
  }

  console.log(`🔍 Found ${linkFields.length} link field(s)`)

  let processed = 0
  let createdReciprocals = 0
  let repairedPairs = 0
  let viewFieldInserts = 0
  let backfillUpdates = 0

  async function ensureViewFields(tableId: string, fieldName: string, position: number) {
    const { data: views, error: viewsError } = await supabase
      .from('views')
      .select('id')
      .eq('table_id', tableId)

    if (viewsError) throw viewsError
    const viewIds = (views || []).map((v: any) => v.id).filter(Boolean)
    if (viewIds.length === 0) return

    // Find which (view_id, field_name) already exist
    const { data: existing, error: existingError } = await supabase
      .from('view_fields')
      .select('view_id, field_name')
      .eq('field_name', fieldName)
      .in('view_id', viewIds)

    if (existingError) throw existingError
    const existingSet = new Set((existing || []).map((r: any) => `${r.view_id}::${r.field_name}`))

    const toInsert = viewIds
      .filter((vid) => !existingSet.has(`${vid}::${fieldName}`))
      .map((view_id) => ({ view_id, field_name: fieldName, visible: true, position }))

    if (toInsert.length === 0) return

    if (!dryRun) {
      const { error: insErr } = await supabase.from('view_fields').insert(toInsert)
      if (insErr) throw insErr
    }
    viewFieldInserts += toInsert.length
  }

  async function fetchFieldById(id: string): Promise<TableFieldRow | null> {
    const { data, error } = await supabase
      .from('table_fields')
      .select('id, table_id, name, label, type, position, order_index, options')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return (data as any) || null
  }

  async function findExistingReciprocal(targetTableId: string, sourceTableId: string): Promise<TableFieldRow | null> {
    // Look for a link field in target table that points back to source table.
    const { data, error } = await supabase
      .from('table_fields')
      .select('id, table_id, name, label, type, position, order_index, options')
      .eq('table_id', targetTableId)
      .eq('type', 'link_to_table')
      .contains('options', { linked_table_id: sourceTableId })
      .order('created_at', { ascending: true })

    if (error) throw error
    const rows = (data || []) as TableFieldRow[]
    if (rows.length === 0) return null
    return rows[0]
  }

  async function updateFieldOptions(fieldId: string, nextOptions: any) {
    if (dryRun) return
    const { error } = await supabase
      .from('table_fields')
      .update({ options: nextOptions, updated_at: new Date().toISOString() })
      .eq('id', fieldId)
    if (error) throw error
  }

  async function createReciprocalField(sourceField: TableFieldRow, targetTableId: string): Promise<TableFieldRow> {
    const sourceTable = tableById.get(sourceField.table_id)
    const targetTable = tableById.get(targetTableId)
    if (!sourceTable || !targetTable) {
      throw new Error('Missing source or target table metadata')
    }

    // Load existing target fields for uniqueness
    const { data: targetFields, error: targetFieldsError } = await supabase
      .from('table_fields')
      .select('name, position, order_index')
      .eq('table_id', targetTableId)

    if (targetFieldsError) throw targetFieldsError
    const existingNames = new Set((targetFields || []).map((f: any) => String(f.name || '').toLowerCase()))

    const reciprocalLabel =
      String(sourceTable.name || '').trim() ||
      String(sourceField.label || '').trim() ||
      'Linked records'

    const baseName = sanitizeFieldName(reciprocalLabel) || 'linked_records'
    let candidate = baseName
    let i = 0
    while (existingNames.has(candidate.toLowerCase())) {
      i += 1
      candidate = `${baseName}_${i}`.substring(0, 63)
      if (i > 50) throw new Error('Failed to find unique reciprocal field name')
    }

    const position = (targetFields || []).length
    const maxOrderIndex = (targetFields || []).reduce((max: number, f: any) => {
      const oi = f?.order_index ?? f?.position ?? 0
      return Math.max(max, oi)
    }, -1)
    const order_index = maxOrderIndex + 1

    const sourceOptions = sourceField.options || {}
    const reciprocalOptions = {
      ...(sourceOptions || {}),
      linked_table_id: sourceField.table_id,
      linked_field_id: sourceField.id,
    }

    if (!dryRun) {
      const { data: inserted, error: insError } = await supabase
        .from('table_fields')
        .insert([
          {
            table_id: targetTableId,
            name: candidate,
            label: reciprocalLabel,
            type: 'link_to_table',
            position,
            order_index,
            required: false,
            default_value: null,
            options: reciprocalOptions,
          },
        ])
        .select()
        .single()

      if (insError) throw insError

      // Add physical column to the target table.
      const pgType = isMultiLink(reciprocalOptions) ? 'uuid[]' : 'uuid'
      const sql = `ALTER TABLE ${quoteMaybeQualifiedName(targetTable.supabase_table)} ADD COLUMN ${quoteIdent(candidate)} ${pgType};`
      const { error: sqlError } = await supabase.rpc('execute_sql_safe', { sql_text: sql })
      if (sqlError) {
        // Roll back metadata if we can
        await supabase.from('table_fields').delete().eq('id', inserted.id)
        throw sqlError
      }

      createdReciprocals += 1
      return inserted as TableFieldRow
    }

    // Dry run: return a fake row (minimal) so downstream can continue.
    createdReciprocals += 1
    return {
      id: 'dry-run',
      table_id: targetTableId,
      name: candidate,
      label: reciprocalLabel,
      type: 'link_to_table',
      position,
      order_index,
      options: reciprocalOptions,
    }
  }

  async function backfillPair(sourceField: TableFieldRow, reciprocalField: TableFieldRow) {
    if (noBackfill) return
    const sourceTable = tableById.get(sourceField.table_id)
    const targetTable = tableById.get(reciprocalField.table_id)
    if (!sourceTable || !targetTable) return

    const sourceCol = sourceField.name
    const targetCol = reciprocalField.name
    const targetIsMulti = isMultiLink(reciprocalField.options || {})

    // Pull source rows in pages
    const page = 1000
    for (let from = 0; ; from += page) {
      const to = from + page - 1
      const { data: rows, error } = await supabase
        .from(sourceTable.supabase_table)
        .select(`id, ${sourceCol}`)
        .range(from, to)

      if (error) {
        console.warn(`⚠️  Backfill skipped for ${sourceTable.supabase_table}.${sourceCol}:`, error.message || error)
        return
      }
      const batch = (rows || []) as any[]
      if (batch.length === 0) break

      // Build mapping targetId -> sourceIds[] from this batch
      const additions = new Map<string, string[]>()
      for (const r of batch) {
        const sourceId = r?.id
        if (!isUuid(sourceId)) continue
        const raw = r?.[sourceCol]
        const linkedIds = asArray<string>(raw).filter(isUuid)
        if (linkedIds.length === 0) continue
        for (const tid of linkedIds) {
          const arr = additions.get(tid) || []
          arr.push(sourceId)
          additions.set(tid, arr)
        }
      }

      const targetIds = Array.from(additions.keys())
      if (targetIds.length === 0) {
        if (batch.length < page) break
        continue
      }

      // Fetch current values in target table for these ids
      const { data: targetRows, error: targetErr } = await supabase
        .from(targetTable.supabase_table)
        .select(`id, ${targetCol}`)
        .in('id', targetIds)

      if (targetErr) {
        console.warn(`⚠️  Backfill target read failed for ${targetTable.supabase_table}.${targetCol}:`, targetErr.message || targetErr)
        return
      }

      const updates: Array<{ id: string; value: any }> = []
      for (const tr of (targetRows || []) as any[]) {
        const tid = tr?.id
        if (!isUuid(tid)) continue
        const toAdd = additions.get(tid) || []
        if (toAdd.length === 0) continue

        if (targetIsMulti) {
          const current = asArray<string>(tr?.[targetCol]).filter(isUuid)
          const next = uniq([...current, ...toAdd])
          // Only write when something changes
          if (next.length !== current.length) updates.push({ id: tid, value: next })
        } else {
          // Scalar: if empty, set; if already set, leave it.
          const current = tr?.[targetCol]
          if (!isUuid(current)) updates.push({ id: tid, value: toAdd[0] })
        }
      }

      if (updates.length > 0) {
        if (!dryRun) {
          // Apply sequentially to avoid huge payloads and to surface errors clearly.
          for (const u of updates) {
            const { error: upErr } = await supabase
              .from(targetTable.supabase_table)
              .update({ [targetCol]: u.value } as any)
              .eq('id', u.id)
            if (upErr) {
              console.warn(`⚠️  Backfill update failed for ${targetTable.supabase_table}.${targetCol} id=${u.id}:`, upErr.message || upErr)
              continue
            }
            backfillUpdates += 1
          }
        } else {
          backfillUpdates += updates.length
        }
      }

      if (batch.length < page) break
    }
  }

  for (const field of linkFields) {
    processed += 1
    if (limit && processed > limit) break

    const sourceTable = tableById.get(field.table_id)
    const sourceOptions = field.options || {}
    const targetTableId = sourceOptions?.linked_table_id

    if (!sourceTable) continue
    if (!isUuid(field.id) || !isUuid(field.table_id)) continue
    if (typeof targetTableId !== 'string' || !isUuid(targetTableId)) continue
    if (targetTableId === field.table_id) continue

    // Skip already-repaired pairs (we'll still ensure view_fields).
    let reciprocal: TableFieldRow | null = null
    const linkedFieldId = sourceOptions?.linked_field_id

    if (isUuid(linkedFieldId)) {
      reciprocal = await fetchFieldById(linkedFieldId)
      if (reciprocal && reciprocal.type !== 'link_to_table') reciprocal = null
    }

    if (!reciprocal) {
      // Try to find an existing reciprocal by searching in the target table.
      reciprocal = await findExistingReciprocal(targetTableId, field.table_id)
    }

    if (!reciprocal) {
      // Create a new reciprocal field/column
      reciprocal = await createReciprocalField(field, targetTableId)
    }

    // Ensure both sides point to each other
    const desiredSourceOptions = { ...(sourceOptions || {}), linked_field_id: reciprocal.id }
    const desiredReciprocalOptions = {
      ...(reciprocal.options || {}),
      linked_table_id: field.table_id,
      linked_field_id: field.id,
    }

    const sourceNeedsUpdate = sourceOptions?.linked_field_id !== reciprocal.id
    const reciprocalNeedsUpdate = (reciprocal.options || {})?.linked_field_id !== field.id || (reciprocal.options || {})?.linked_table_id !== field.table_id

    if (sourceNeedsUpdate) await updateFieldOptions(field.id, desiredSourceOptions)
    if (reciprocalNeedsUpdate && reciprocal.id !== 'dry-run') await updateFieldOptions(reciprocal.id, desiredReciprocalOptions)
    if (sourceNeedsUpdate || reciprocalNeedsUpdate) repairedPairs += 1

    // Ensure view_fields exist so the columns show
    await ensureViewFields(field.table_id, field.name, field.position ?? 0)
    if (reciprocal.id !== 'dry-run') await ensureViewFields(reciprocal.table_id, reciprocal.name, reciprocal.position ?? 0)

    // Backfill values (historic data)
    if (reciprocal.id !== 'dry-run') await backfillPair(field, reciprocal)
  }

  console.log('='.repeat(60))
  console.log(`✅ Processed: ${processed}`)
  console.log(`✅ Created reciprocals: ${createdReciprocals}`)
  console.log(`✅ Repaired link pairs: ${repairedPairs}`)
  console.log(`✅ view_fields inserted: ${viewFieldInserts}`)
  console.log(`✅ Backfill row updates: ${backfillUpdates}`)
  if (dryRun) console.log('ℹ️  Dry run only (no changes were written).')
}

main().catch((e) => {
  console.error('❌ repair-linked-fields failed:', e)
  process.exit(1)
})

