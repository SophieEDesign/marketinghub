import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/roles'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { table, recordIds } = body

    if (!table || !recordIds || !Array.isArray(recordIds) || recordIds.length === 0) {
      return NextResponse.json(
        { error: 'table and recordIds array are required' },
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

    // Get table info
    const { data: tableInfo } = await supabase
      .from('tables')
      .select('supabase_table')
      .eq('supabase_table', table)
      .single()

    if (!tableInfo) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      )
    }

    // Delete records in batches
    const batchSize = 100
    const batches = []
    for (let i = 0; i <recordIds.length; i += batchSize) {
      batches.push(recordIds.slice(i, i + batchSize))
    }

    const deletePromises = batches.map((batch) =>
      supabase
        .from(table)
        .delete()
        .in('id', batch)
    )

    await Promise.all(deletePromises)

    return NextResponse.json({
      success: true,
      deleted: recordIds.length,
    })
  } catch (error: any) {
    console.error('Error in bulk delete:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete records' },
      { status: 500 }
    )
  }
}

