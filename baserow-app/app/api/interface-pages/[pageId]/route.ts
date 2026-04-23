import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getInterfacePage, updateInterfacePage, deleteInterfacePage } from '@/lib/interface/pages'
import { isAdmin } from '@/lib/roles'

function isPermissionDenied(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes('permission') || normalized.includes('policy') || normalized.includes('forbidden')
}

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
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }
    const { pageId } = await params
    const body = await request.json()
    const page = await updateInterfacePage(pageId, body)
    return NextResponse.json(page)
  } catch (error: unknown) {
    const errorMessage = (error as { message?: string })?.message || 'Failed to update page'
    if (isPermissionDenied(errorMessage)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to update page' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }
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
  } catch (error: unknown) {
    const errorObj = error as { message?: string } | null
    const errorMessage = errorObj?.message || ''
    if (isPermissionDenied(errorMessage)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to delete page' },
      { status: 500 }
    )
  }
}

