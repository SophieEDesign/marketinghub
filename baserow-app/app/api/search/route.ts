import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/roles'
import { debugError } from '@/lib/debug'

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

    // Search views (includes pages and interfaces) - OLD SYSTEM
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

    // Search interface_pages table - NEW SYSTEM
    if (!type || type === 'pages') {
      const userIsAdmin = await isAdmin()
      let interfacePagesQuery = supabase
        .from('interface_pages')
        .select('id, name, page_type, group_id, is_admin_only')
        .ilike('name', `%${query}%`)
      
      // Filter out admin-only pages for non-admin users
      if (!userIsAdmin) {
        interfacePagesQuery = interfacePagesQuery.or('is_admin_only.is.null,is_admin_only.eq.false')
      }
      
      const { data: interfacePages } = await interfacePagesQuery.limit(20)
      
      if (interfacePages) {
        // Load group names for disambiguation
        const groupIds = interfacePages.map(p => p.group_id).filter(Boolean) as string[]
        const groupMap = new Map<string, string>()
        if (groupIds.length > 0) {
          const { data: groups } = await supabase
            .from('interface_groups')
            .select('id, name')
            .in('id', groupIds)
          
          if (groups) {
            groups.forEach(g => groupMap.set(g.id, g.name))
          }
        }

        results.push(...interfacePages.map(p => {
          const groupName = p.group_id ? groupMap.get(p.group_id) : null
          const displayName = groupName ? `${p.name} (${groupName})` : p.name
          
          return {
            id: p.id,
            name: displayName,
            originalName: p.name,
            type: 'interface',
            page_type: p.page_type,
            table_id: null,
            searchType: 'page',
            group_id: p.group_id,
            group_name: groupName,
          }
        }))
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

    // Deduplicate by ID (views and interface_pages can overlap in legacy setups)
    const seen = new Set<string>()
    const deduped = results.filter((r) => {
      if (seen.has(r.id)) return false
      seen.add(r.id)
      return true
    })

    return NextResponse.json({ items: deduped })
  } catch (error: any) {
    debugError('Error searching:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to search' },
      { status: 500 }
    )
  }
}

