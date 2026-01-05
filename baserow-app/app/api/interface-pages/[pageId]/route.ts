import { NextRequest, NextResponse } from 'next/server'
import { getInterfacePage, updateInterfacePage, deleteInterfacePage } from '@/lib/interface/pages'

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { pageId: string } }
) {
  try {
    const body = await request.json()
    const page = await updateInterfacePage(params.pageId, body)
    return NextResponse.json(page)
  } catch (error: any) {
    console.error('Error updating interface page:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update page' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { pageId: string } }
) {
  try {
    await deleteInterfacePage(params.pageId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting interface page:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete page' },
      { status: 500 }
    )
  }
}

