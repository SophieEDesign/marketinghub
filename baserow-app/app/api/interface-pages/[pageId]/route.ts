import { NextRequest, NextResponse } from 'next/server'
import { getInterfacePage } from '@/lib/interface/pages'

export async function GET(
  request: NextRequest,
  { params }: { params: { pageId: string } }
) {
  try {
    const page = await getInterfacePage(params.pageId)
    
    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    return NextResponse.json(page)
  } catch (error) {
    console.error('Error loading interface page:', error)
    return NextResponse.json(
      { error: 'Failed to load page' },
      { status: 500 }
    )
  }
}

