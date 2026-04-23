import { NextRequest, NextResponse } from 'next/server'
import { createInterfacePage, getAllInterfacePages } from '@/lib/interface/pages'
import { PageType } from '@/lib/interface/page-types'
import { PageConfig } from '@/lib/interface/page-config'
import { isAdmin } from '@/lib/roles'

export async function GET() {
  try {
    const pages = await getAllInterfacePages()
    return NextResponse.json(pages)
  } catch (error) {
    console.error('Error loading interface pages:', error)
    return NextResponse.json(
      { error: 'Failed to load pages' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }
    const body = await request.json()
    const {
      name,
      page_type,
      source_view,
      base_table,
      config,
      group_id,
    } = body

    if (!name || !page_type) {
      return NextResponse.json(
        { error: 'Name and page_type are required' },
        { status: 400 }
      )
    }

    const page = await createInterfacePage(
      name,
      page_type as PageType,
      source_view || null,
      base_table || null,
      (config || {}) as PageConfig,
      group_id || null
    )

    return NextResponse.json(page)
  } catch (error: any) {
    console.error('Error creating interface page:', error)
    const message = String(error?.message || '')
    if (message.toLowerCase().includes('permission') || message.toLowerCase().includes('policy')) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to create page' },
      { status: 500 }
    )
  }
}

