import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/roles'
import { getPageTypeTemplates } from '@/lib/interface/pageTypes'

/**
 * GET /api/page-types - Fetch all page type templates
 * Filters admin-only templates based on user role
 */
export async function GET(request: NextRequest) {
  try {
    const userIsAdmin = await isAdmin()
    const templates = await getPageTypeTemplates(userIsAdmin)
    
    return NextResponse.json({ templates })
  } catch (error: any) {
    console.error('Error fetching page types:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch page types' },
      { status: 500 }
    )
  }
}

