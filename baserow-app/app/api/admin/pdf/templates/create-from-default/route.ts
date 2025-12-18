import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/admin/pdf/templates/create-from-default - Create a template from default
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
    const { name, defaultTemplate } = body

    // Default template structure if not provided
    const defaultTemplateContent = defaultTemplate || {
      name: name || 'Default Template',
      content: {
        header: {
          enabled: true,
          height: 50,
          content: '<div style="text-align: center; padding: 10px;">Header</div>'
        },
        body: {
          enabled: true,
          content: '<div style="padding: 20px;">Body content</div>'
        },
        footer: {
          enabled: true,
          height: 30,
          content: '<div style="text-align: center; padding: 5px;">Footer</div>'
        }
      },
      settings: {
        pageSize: 'A4',
        orientation: 'portrait',
        margins: {
          top: 20,
          right: 20,
          bottom: 20,
          left: 20
        }
      }
    }

    // Insert template from default
    const { data, error } = await supabase
      .from('pdf_templates')
      .insert([
        {
          name: name || defaultTemplateContent.name || 'New Template',
          content: defaultTemplateContent.content || {},
          settings: defaultTemplateContent.settings || {},
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
      
      console.error('Error creating PDF template from default:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to create template from default' },
        { status: 500 }
      )
    }

    return NextResponse.json({ template: data })
  } catch (error: any) {
    console.error('Error in POST /api/admin/pdf/templates/create-from-default:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create template from default' },
      { status: 500 }
    )
  }
}
