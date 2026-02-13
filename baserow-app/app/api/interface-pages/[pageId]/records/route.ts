import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getInterfacePage } from '@/lib/interface/pages'
import { getUserRole } from '@/lib/roles'
import { runRecordAutomations } from '@/lib/automations/record-trigger'
import type { PageConfig } from '@/lib/interface/page-config'

function canCreate(role: 'admin' | 'member' | null, pageConfig: PageConfig): boolean {
  if (!role) return false
  if (role === 'admin') return true
  const createPerm = pageConfig?.record_actions?.create ?? 'both'
  return createPerm === 'both'
}

/**
 * POST /api/interface-pages/[pageId]/records
 * Create a record from an interface record page, respecting page config permissions.
 *
 * Body:
 * - fieldName?: string (optional, if you want to prefill a primary field)
 * - fieldValue?: unknown
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId } = await params
    const body = await request.json().catch(() => ({}))
    const { fieldName, fieldValue } = body || {}

    const supabase = await createClient()
    const role = await getUserRole()

    const page = await getInterfacePage(pageId)
    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    const pageConfig: PageConfig = page.config || {}
    const tableId =
      page.base_table ||
      pageConfig.table_id ||
      (pageConfig as { tableId?: string }).tableId ||
      (pageConfig as { primary_table_id?: string }).primary_table_id ||
      null

    if (!tableId) {
      return NextResponse.json({ error: 'No table configured for this page' }, { status: 400 })
    }

    if (!canCreate(role, pageConfig)) {
      return NextResponse.json({ error: 'Not allowed to create records on this page' }, { status: 403 })
    }

    const { data: table, error: tableError } = await supabase
      .from('tables')
      .select('supabase_table')
      .eq('id', tableId)
      .maybeSingle()

    if (tableError || !table?.supabase_table) {
      return NextResponse.json({ error: 'Table not found or not configured' }, { status: 400 })
    }

    const newData: Record<string, unknown> = {}
    if (fieldName && typeof fieldName === 'string') {
      newData[fieldName] = fieldValue ?? null
    }

    const { data, error } = await supabase
      .from(table.supabase_table)
      .insert([newData])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const recordData = data as Record<string, unknown>
    const createdId = (recordData?.id as string) || (recordData?.record_id as string)

    // Trigger row_created automations (fire-and-forget; don't block response)
    runRecordAutomations(tableId, 'row_created', recordData).catch((err) =>
      console.error('Automation trigger error:', err)
    )

    return NextResponse.json({ record: data, recordId: createdId }, { status: 200 })
  } catch (error: unknown) {
    const errorMessage = (error as { message?: string })?.message || 'Failed to create record'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

