import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/search - Global search across tables, pages, views, interfaces
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''
    const type = searchParams.get('type') // Optional filter by type

    if (!query.trim()) {
      return NextResponse.json({ items: [] })
    }

    const supabase = await createClient()
    const results: any[] = []

    // Search tables
    if (!type || type === 'tables') {
      const { data: tables } = await supabase
        .from('tables')
        .select('id, name, description')
        .ilike('name', `%${query}%`)
        .limit(20)
      
      if (tables) {
        results.push(...tables.map(t => ({
          ...t,
          type: 'table',
          searchType: 'table',
        })))
      }
    }

    // Search views (includes pages and interfaces)
    if (!type || type === 'pages' || type === 'views') {
      const { data: views } = await supabase
        .from('views')
        .select('id, name, type, table_id')
        .ilike('name', `%${query}%`)
        .limit(20)
      
      if (views) {
        results.push(...views.map(v => ({
          id: v.id,
          name: v.name,
          type: v.type,
          table_id: v.table_id,
          searchType: v.type === 'interface' ? 'page' : 'view',
        })))
      }
    }

    // Search table fields (if searching in tables)
    if (!type || type === 'tables') {
      const { data: fields } = await supabase
        .from('table_fields')
        .select('id, name, table_id, tables!inner(name)')
        .ilike('name', `%${query}%`)
        .limit(10)
      
      if (fields) {
        results.push(...fields.map(f => ({
          id: f.id,
          name: `${f.name} (field in ${(f.tables as any)?.name})`,
          table_id: f.table_id,
          searchType: 'field',
        })))
      }
    }

    return NextResponse.json({ items: results })
  } catch (error: any) {
    console.error('Error searching:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to search' },
      { status: 500 }
    )
  }
}

