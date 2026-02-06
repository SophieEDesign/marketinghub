/**
 * Core data table check for record navigation rules.
 * Only tables with is_core_data = true may open as full-page record routes;
 * all other records open in the RecordPanel modal.
 */

import { createClient } from '@/lib/supabase/server'

/**
 * Returns true if the table is marked as core data (full-page record views allowed).
 * Server-only; use GET /api/tables/[tableId]/is-core-data from the client.
 */
export async function isCoreDataTable(tableId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tables')
    .select('is_core_data')
    .eq('id', tableId)
    .single()

  if (error || data == null) {
    return false
  }

  return Boolean((data as { is_core_data?: boolean }).is_core_data)
}
