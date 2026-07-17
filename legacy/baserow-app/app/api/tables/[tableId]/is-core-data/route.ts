/**
 * GET /api/tables/[tableId]/is-core-data
 * Returns whether the table is core data (full-page record views allowed).
 */

import { NextResponse } from 'next/server'
import { isCoreDataTable } from '@/lib/core-data/is-core-data-table'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    if (!tableId) {
      return NextResponse.json({ isCoreData: false }, { status: 400 })
    }
    const isCoreData = await isCoreDataTable(tableId)
    return NextResponse.json({ isCoreData })
  } catch (error) {
    console.error('[is-core-data] Error:', error)
    return NextResponse.json({ isCoreData: false }, { status: 500 })
  }
}
