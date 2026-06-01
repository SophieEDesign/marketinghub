import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTable } from '@/lib/crud/tables'
import { getTableFields } from '@/lib/fields/schema'
import { generateMigrateLinkColumnToUuidArraySQL } from '@/lib/fields/sqlGenerator'

function isMultiLinkField(field: {
  type?: string
  options?: Record<string, unknown>
}): boolean {
  if (field.type !== 'link_to_table') return false
  const opts = field.options || {}
  const relationshipType = opts.relationship_type
  const maxSelections = opts.max_selections
  return (
    relationshipType === 'one-to-many' ||
    relationshipType === 'many-to-many' ||
    (typeof maxSelections === 'number' && maxSelections > 1)
  )
}

/**
 * POST /api/tables/[tableId]/migrate-link-column
 * Body: { columnName: string }
 *
 * Migrates a uuid link column to uuid[] when the field metadata expects multiple links.
 * Uses service role because execute_sql_safe is not granted to authenticated clients.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tableId } = await params
    if (!tableId?.trim()) {
      return NextResponse.json({ error: 'Invalid tableId' }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as { columnName?: string }
    const columnName = String(body.columnName || '').trim()
    if (!columnName) {
      return NextResponse.json({ error: 'columnName is required' }, { status: 400 })
    }

    const table = await getTable(tableId)
    if (!table?.supabase_table) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    }

    const fields = await getTableFields(tableId)
    const field = fields.find((f) => f.name === columnName)
    if (!field || field.type !== 'link_to_table') {
      return NextResponse.json(
        { error: `Field "${columnName}" is not a linked record field` },
        { status: 400 }
      )
    }
    if (
      !isMultiLinkField({
        type: field.type,
        options: field.options as Record<string, unknown> | undefined,
      })
    ) {
      return NextResponse.json(
        {
          error:
            `Field "${columnName}" is not configured for multiple links. ` +
            `Change relationship type to one-to-many before migrating.`,
        },
        { status: 400 }
      )
    }

    const tableName = String(table.supabase_table).replace(/^public\./i, '')
    const sql = generateMigrateLinkColumnToUuidArraySQL(tableName, columnName)

    const admin = createAdminClient()
    const { error: sqlError } = await admin.rpc('execute_sql_safe', { sql_text: sql })
    if (sqlError) {
      console.error('[migrate-link-column] SQL error:', sqlError)
      return NextResponse.json(
        { error: sqlError.message || 'Failed to migrate column' },
        { status: 500 }
      )
    }

    try {
      await admin.rpc('execute_sql_safe', { sql_text: "NOTIFY pgrst, 'reload schema';" })
    } catch {
      // non-fatal
    }

    return NextResponse.json({ success: true, tableName, columnName })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to migrate link column'
    console.error('[migrate-link-column]', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
