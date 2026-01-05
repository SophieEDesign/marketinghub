/**
 * Type-only exports for InterfacePage
 * This file can be safely imported in client components
 */

import type { PageType } from './page-types'

export interface InterfacePage {
  id: string
  name: string
  page_type: PageType
  source_view: string | null // Deprecated: use saved_view_id instead
  base_table: string | null // Deprecated: use form_config_id instead
  config: any // PageConfig - using any to avoid importing server code
  group_id: string | null
  order_index: number
  created_at: string
  updated_at: string
  created_by: string | null
  is_admin_only: boolean
  // Page anchors - exactly one must be set
  saved_view_id: string | null // For list/gallery/kanban/calendar/timeline/record_review
  dashboard_layout_id: string | null // For dashboard/overview (references view_blocks.view_id)
  form_config_id: string | null // For form pages
  record_config_id: string | null // For record_review pages
}

