/**
 * Script to list all record_review pages
 * Run with: npx tsx scripts/list-record-review-pages.ts
 * 
 * This helps identify duplicate record review pages
 */

import { createClient } from '@/lib/supabase/server'

async function listRecordReviewPages() {
  const supabase = await createClient()
  
  // Get all record_review pages
  const { data: pages, error } = await supabase
    .from('interface_pages')
    .select('id, name, page_type, base_table, saved_view_id, created_at, updated_at, group_id')
    .eq('page_type', 'record_review')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error loading pages:', error)
    return
  }

  if (!pages || pages.length === 0) {
    console.log('No record_review pages found.')
    return
  }

  console.log(`\nFound ${pages.length} record_review page(s):\n`)
  console.log('─'.repeat(100))
  
  // Group by base_table to identify potential duplicates
  const pagesByTable = new Map<string, typeof pages>()
  
  pages.forEach(page => {
    const tableId = page.base_table || 'no-table'
    if (!pagesByTable.has(tableId)) {
      pagesByTable.set(tableId, [])
    }
    pagesByTable.get(tableId)!.push(page)
  })

  // Display pages grouped by table
  pagesByTable.forEach((tablePages, tableId) => {
    console.log(`\n📊 Table: ${tableId === 'no-table' ? 'No table configured' : tableId}`)
    console.log(`   Found ${tablePages.length} page(s) for this table:\n`)
    
    tablePages.forEach((page, index) => {
      const createdDate = new Date(page.created_at).toLocaleDateString()
      const updatedDate = new Date(page.updated_at || page.created_at).toLocaleDateString()
      const isRecent = new Date(page.updated_at || page.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      
      console.log(`   ${index + 1}. ${page.name}`)
      console.log(`      ID: ${page.id}`)
      console.log(`      Created: ${createdDate}`)
      console.log(`      Updated: ${updatedDate} ${isRecent ? '🆕' : ''}`)
      console.log(`      View ID: ${page.saved_view_id || 'none'}`)
      console.log(`      Group ID: ${page.group_id || 'none'}`)
      console.log('')
    })
    
    // Flag potential duplicates
    if (tablePages.length > 1) {
      console.log(`   ⚠️  POTENTIAL DUPLICATES: ${tablePages.length} pages for the same table`)
      console.log(`      Consider keeping the most recent one (${tablePages[0].name})`)
      console.log('')
    }
  })

  console.log('─'.repeat(100))
  console.log('\n💡 Tips:')
  console.log('   - Pages with the same base_table are likely duplicates')
  console.log('   - Keep the most recently updated page (marked with 🆕)')
  console.log('   - Delete old pages via Settings > Pages tab')
  console.log('   - Or use: DELETE /api/interface-pages/[pageId]\n')
}

// Run the script
listRecordReviewPages().catch(console.error)

