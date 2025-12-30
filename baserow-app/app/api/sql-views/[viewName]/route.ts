import { NextRequest, NextResponse } from 'next/server'
import { querySqlView } from '@/lib/interface/pages'

export async function POST(
  request: NextRequest,
  { params }: { params: { viewName: string } }
) {
  try {
    const body = await request.json()
    const filters = body.filters || {}

    // Decode the view name (URL encoded)
    const viewName = decodeURIComponent(params.viewName)

    // Query the SQL view
    const data = await querySqlView(viewName, filters)

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Error querying SQL view:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to query SQL view' },
      { status: 500 }
    )
  }
}

