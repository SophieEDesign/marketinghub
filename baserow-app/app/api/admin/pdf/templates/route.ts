import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/admin/pdf/templates - Get all PDF templates
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Check authentication
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has admin role (you may need to adjust this based on your auth system)
    // For now, we'll allow any authenticated user
    
    // Query PDF templates table
    const { data, error } = await supabase
      .from('pdf_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      // If table doesn't exist, return empty array instead of error
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        return NextResponse.json({ templates: [] })
      }
      
      console.error('Error fetching PDF templates:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to fetch templates' },
        { status: 500 }
      )
    }

    return NextResponse.json({ templates: data || [] })
  } catch (error: any) {
    console.error('Error in GET /api/admin/pdf/templates:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load templates' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/pdf/templates - Create a new PDF template
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Check authentication
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, content, settings } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Template name is required' },
        { status: 400 }
      )
    }

    // Insert new template
    const { data, error } = await supabase
      .from('pdf_templates')
      .insert([
        {
          name,
          content: content || null,
          settings: settings || {},
          created_by: user.id,
        },
      ])
      .select()
      .single()

    if (error) {
      // If table doesn't exist, we need to create it first
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        return NextResponse.json(
          { error: 'PDF templates table does not exist. Please run database migration first.' },
          { status: 500 }
        )
      }
      
      console.error('Error creating PDF template:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to create template' },
        { status: 500 }
      )
    }

    return NextResponse.json({ template: data })
  } catch (error: any) {
    console.error('Error in POST /api/admin/pdf/templates:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create template' },
      { status: 500 }
    )
  }
}
