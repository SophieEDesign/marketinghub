import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getInterfacePage, updateInterfacePage, deleteInterfacePage } from '@/lib/interface/pages'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId } = await params
    const page = await getInterfacePage(pageId)
    
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
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId } = await params
    const body = await request.json()
    const page = await updateInterfacePage(pageId, body)
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
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId } = await params
    
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    await deleteInterfacePage(pageId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting interface page:', error)
    
    // Return appropriate status codes
    const status = error.message?.includes('permission') || error.message?.includes('not found') 
      ? 403 
      : error.message?.includes('Authentication') 
      ? 401 
      : 500
    
    return NextResponse.json(
      { error: error.message || 'Failed to delete page' },
      { status }
    )
  }
}

