import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/pages - Create a new page
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const body = await request.json()
    const { name, description, settings } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Page name is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('pages')
      .insert([
        {
          name,
          description: description || null,
          settings: settings || {
            access: 'authenticated',
            layout: { cols: 12, rowHeight: 30, margin: [10, 10] },
          },
          created_by: user?.id,
        },
      ])
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ page: data })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create page' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/pages - List all pages
 */
export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('pages')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ pages: data || [] })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to load pages' },
      { status: 500 }
    )
  }
}
