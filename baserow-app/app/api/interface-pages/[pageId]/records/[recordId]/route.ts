import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getInterfacePage } from '@/lib/interface/pages'
import { getUserRole } from '@/lib/roles'
import type { PageConfig } from '@/lib/interface/page-config'

function canDelete(role: 'admin' | 'member' | null, pageConfig: PageConfig): boolean {
  if (!role) return false
  if (role === 'admin') return true
  const deletePerm = pageConfig?.record_actions?.delete ?? 'admin'
  return deletePerm === 'both'
}

/**
 * DELETE /api/interface-pages/[pageId]/records/[recordId]
 * Delete a record from an interface record page, respecting page config permissions.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string; recordId: string }> }
) {
  try {
    const { pageId, recordId } = await params
    const supabase = await createClient()
    const role = await getUserRole()

    const page = await getInterfacePage(pageId)
    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    const pageConfig = page.config || {}
    const pageEditable = (pageConfig as any).allow_editing !== false
    if (!pageEditable) {
      return NextResponse.json({ error: 'Page is view-only' }, { status: 403 })
    }

    const tableId =
      page.base_table ||
      (pageConfig as any).table_id ||
      (pageConfig as any).tableId ||
      (pageConfig as any).primary_table_id ||
      null

    if (!tableId) {
      return NextResponse.json({ error: 'No table configured for this page' }, { status: 400 })
    }

    if (!canDelete(role, pageConfig)) {
      return NextResponse.json({ error: 'Not allowed to delete records on this page' }, { status: 403 })
    }

    const { data: table, error: tableError } = await supabase
      .from('tables')
      .select('supabase_table')
      .eq('id', tableId)
      .maybeSingle()

    if (tableError || !table?.supabase_table) {
      return NextResponse.json({ error: 'Table not found or not configured' }, { status: 400 })
    }

    const { error } = await supabase.from(table.supabase_table).delete().eq('id', recordId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: unknown) {
    const errorMessage = (error as { message?: string })?.message || 'Failed to delete record'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

