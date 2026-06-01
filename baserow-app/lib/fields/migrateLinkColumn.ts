import type { SupabaseClient } from '@supabase/supabase-js'

function normalizeTableName(raw: string): string {
  return String(raw || '').trim().replace(/^public\./i, '')
}

function isMissingRpcError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const msg = String(error.message || '').toLowerCase()
  return (
    error.code === '42883' ||
    error.code === 'PGRST202' ||
    msg.includes('could not find the function') ||
    msg.includes('does not exist')
  )
}

/**
 * Migrate a link_to_table column from uuid → uuid[] when the field allows multiple links.
 * Uses a narrow RPC when available; falls back to a server API route (service role).
 */
export async function migrateLinkColumnToUuidArray(
  supabase: SupabaseClient,
  tableId: string,
  tableName: string,
  columnName: string
): Promise<void> {
  const p_table_name = normalizeTableName(tableName)
  const p_column_name = String(columnName || '').trim()
  if (!p_table_name || !p_column_name) {
    throw new Error('Table name and column name are required for link column migration')
  }

  const { error: rpcError } = await supabase.rpc('migrate_link_column_to_uuid_array', {
    p_table_name,
    p_column_name,
  })

  if (!rpcError) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    return
  }

  if (!isMissingRpcError(rpcError)) {
    throw new Error(
      rpcError.message ||
        'Could not migrate link column to support multiple values. Please contact an administrator.'
    )
  }

  const res = await fetch(`/api/tables/${encodeURIComponent(tableId)}/migrate-link-column`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ columnName: p_column_name }),
  })

  const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
  if (!res.ok) {
    throw new Error(
      body.error ||
        body.message ||
        `Could not migrate link column (${res.status}). Please contact an administrator.`
    )
  }

  await new Promise((resolve) => setTimeout(resolve, 150))
}
