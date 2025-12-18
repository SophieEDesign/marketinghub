import { createClient } from '@/lib/supabase/server'
import type { Page, PageBlock } from '@/lib/interface/types'

export async function loadPage(pageId: string): Promise<Page | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('pages')
    .select('*')
    .eq('id', pageId)
    .single()

  if (error || !data) {
    return null
  }

  return data as Page
}

export async function loadPageBlocks(pageId: string): Promise<PageBlock[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('page_blocks')
    .select('*')
    .eq('page_id', pageId)
    .order('order_index', { ascending: true })

  if (error) {
    console.error('Error loading page blocks:', error)
    return []
  }

  return (data || []) as PageBlock[]
}

export async function loadPageWithBlocks(pageId: string): Promise<{
  page: Page | null
  blocks: PageBlock[]
}> {
  const [page, blocks] = await Promise.all([
    loadPage(pageId),
    loadPageBlocks(pageId),
  ])

  return { page, blocks }
}
