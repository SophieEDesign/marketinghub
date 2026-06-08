import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/roles'
import { buildSoftDeletePatch } from '@/lib/supabase/physical-columns'

async function resolveSupabaseTable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table?: string,
  tableId?: string
): Promise<string | null> {
  if (tableId) {
    const { data } = await supabase
      .from('tables')
      .select('supabase_table')
      .eq('id', tableId)
      .maybeSingle()
    if (data?.supabase_table) return data.supabase_table
  }

  if (table) {
    const { data } = await supabase
      .from('tables')
      .select('supabase_table')
      .eq('supabase_table', table)
      .maybeSingle()
    if (data?.supabase_table) return data.supabase_table
    // Allow direct physical table name when registry row is missing.
    return table
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { table, tableId, recordIds } = body

    const ids = Array.isArray(recordIds)
      ? recordIds.filter((id: unknown) => typeof id === 'string' && id.trim().length > 0)
      : []

    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'recordIds array with at least one id is required' },
        { status: 400 }
      )
    }

    const supabaseTable = await resolveSupabaseTable(supabase, table, tableId)
    if (!supabaseTable) {
      return NextResponse.json(
        { error: 'table or tableId is required' },
        { status: 400 }
      )
    }

    // Check permissions - only admin can bulk delete
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required for bulk delete.' },
        { status: 403 }
      )
    }

    const patch = buildSoftDeletePatch()
    const batchSize = 100
    let deleted = 0

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize)
      const { error, count } = await supabase
        .from(supabaseTable)
        .update(patch, { count: 'exact' })
        .in('id', batch)

      if (error) {
        console.error('Error in bulk delete batch:', error)
        return NextResponse.json(
          { error: error.message || 'Failed to delete records' },
          { status: 500 }
        )
      }

      deleted += count ?? batch.length
    }

    return NextResponse.json({
      success: true,
      deleted,
    })
  } catch (error: any) {
    console.error('Error in bulk delete:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete records' },
      { status: 500 }
    )
  }
}
