import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/roles'
import { normalizeUuid } from '@/lib/utils/ids'

/** Body: groups (without id) and filters (filter_group_id can be "temp-0", "temp-1" etc) */
interface SaveFiltersBody {
  groups: Array<{ view_id: string; condition_type: string; order_index: number }>
  filters: Array<{
    view_id: string
    field_name: string
    operator: string
    value?: string
    filter_group_id?: string | null
    order_index?: number
  }>
}

/**
 * POST /api/views/[viewId]/filters
 * Save filters for a Core Data view. Only Core Data views (table_id not null) are allowed;
 * the default "All Records" view cannot have saved filters.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ viewId: string }> }
) {
  const { viewId } = await params
  const viewUuid = normalizeUuid(viewId)

  if (!viewUuid) {
    return NextResponse.json(
      { error: 'Invalid viewId (expected UUID)', error_code: 'INVALID_VIEW_ID' },
      { status: 400 }
    )
  }

  const admin = await isAdmin()
  if (!admin) {
    return NextResponse.json(
      { error: 'Only admins can save filters on Core Data views', error_code: 'FORBIDDEN' },
      { status: 403 }
    )
  }

  let body: SaveFiltersBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', error_code: 'INVALID_BODY' },
      { status: 400 }
    )
  }

  const { groups = [], filters: filtersPayload = [] } = body
  if (!Array.isArray(groups) || !Array.isArray(filtersPayload)) {
    return NextResponse.json(
      { error: 'Body must include groups and filters arrays', error_code: 'INVALID_BODY' },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  let adminClient: ReturnType<typeof createAdminClient> | null = null
  try {
    adminClient = createAdminClient()
  } catch {
    // Service role not configured; fall back to user client (RLS may block)
  }

  const { data: view, error: viewError } = await supabase
    .from('views')
    .select('id, table_id, name')
    .eq('id', viewUuid)
    .single()

  if (viewError || !view) {
    return NextResponse.json(
      { error: 'View not found', error_code: 'VIEW_NOT_FOUND' },
      { status: 404 }
    )
  }

  if (view.table_id == null) {
    return NextResponse.json(
      { error: 'Only Core Data views (table views) support saved filters via this API', error_code: 'NOT_CORE_DATA' },
      { status: 400 }
    )
  }

  const isAllRecords = (view.name || '').trim().toLowerCase() === 'all records'
  if (isAllRecords) {
    return NextResponse.json(
      {
        error: 'Filters cannot be saved on the default "All Records" view. Create another view to save filters.',
        error_code: 'ALL_RECORDS_VIEW',
      },
      { status: 400 }
    )
  }

  const db = adminClient ?? supabase

  // Delete existing filters first (FK: view_filters reference view_filter_groups)
  await db.from('view_filters').delete().eq('view_id', viewUuid)
  const { error: deleteGroupsErr } = await db
    .from('view_filter_groups')
    .delete()
    .eq('view_id', viewUuid)
  if (deleteGroupsErr) {
    // view_filter_groups table may not exist; continue
  }

  // Insert groups and get back ids
  let insertedGroupIds: string[] = []
  if (groups.length > 0) {
    const groupsToInsert = groups.map((g) => ({
      view_id: viewUuid,
      condition_type: g.condition_type || 'AND',
      order_index: g.order_index ?? 0,
    }))
    const { data: insertedGroups, error: groupsError } = await db
      .from('view_filter_groups')
      .insert(groupsToInsert)
      .select('id')

    if (groupsError) {
      return NextResponse.json(
        {
          error: 'Failed to save filter groups',
          error_code: 'GROUPS_INSERT_ERROR',
          details: groupsError.message,
        },
        { status: 500 }
      )
    }
    insertedGroupIds = (insertedGroups || []).map((g) => g.id)
  }

  // Map temp-N filter_group_id to actual group id
  const filtersToInsert = filtersPayload.map((f) => {
    let filter_group_id: string | null = f.filter_group_id ?? null
    if (
      typeof filter_group_id === 'string' &&
      filter_group_id.startsWith('temp-')
    ) {
      const idx = parseInt(filter_group_id.replace('temp-', ''), 10)
      filter_group_id = insertedGroupIds[idx] ?? null
    }
    return {
      view_id: viewUuid,
      field_name: f.field_name,
      operator: f.operator,
      value: f.value ?? null,
      filter_group_id,
      order_index: f.order_index ?? 0,
    }
  })

  if (filtersToInsert.length > 0) {
    const { error: filtersError } = await db
      .from('view_filters')
      .insert(filtersToInsert)

    if (filtersError) {
      return NextResponse.json(
        {
          error: 'Failed to save filters',
          error_code: 'FILTERS_INSERT_ERROR',
          details: filtersError.message,
        },
        { status: 500 }
      )
    }
  }

  const { data: savedFilters } = await db
    .from('view_filters')
    .select('id, field_name, operator, value')
    .eq('view_id', viewUuid)
    .order('order_index', { ascending: true })

  return NextResponse.json({
    ok: true,
    filters: (savedFilters || []).map((f) => ({
      id: f.id,
      field_name: f.field_name,
      operator: f.operator,
      value: f.value,
    })),
  })
}
