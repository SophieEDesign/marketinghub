import type { SupabaseClient } from '@supabase/supabase-js'
import type { FieldOptions, FieldType } from '@/types/fields'
import { generateAddColumnSQL, generateDropColumnSQL, mapFieldTypeToPostgres } from '@/lib/fields/sqlGenerator'
import { runTableSqlAdmin } from '@/lib/fields/runTableSqlAdmin'

export function normalizeDynamicTableName(raw: string): string {
  return String(raw || '').trim().replace(/^public\./i, '')
}

function isMissingRpcError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const code = String(error.code || '')
  const message = String(error.message || '').toLowerCase()
  return (
    code === '42883' ||
    code === 'PGRST202' ||
    message.includes('could not find the function') ||
    message.includes('does not exist')
  )
}

/** Add a column on a registered dynamic table (authenticated RPC, admin SQL fallback). */
export async function addPhysicalTableColumn(
  supabase: SupabaseClient,
  tableName: string,
  columnName: string,
  fieldType: FieldType,
  options?: FieldOptions
) {
  const pgType = mapFieldTypeToPostgres(fieldType, options)
  const table = normalizeDynamicTableName(tableName)

  const { error: rpcError } = await supabase.rpc('add_registered_table_column', {
    p_table_name: table,
    p_column_name: columnName,
    p_column_type: pgType,
  })

  if (!rpcError) return { error: null as null }
  if (!isMissingRpcError(rpcError)) return { error: rpcError }

  const sql = generateAddColumnSQL(tableName, columnName, fieldType, options)
  return runTableSqlAdmin(sql)
}

/** Drop a column on a registered dynamic table (authenticated RPC, admin SQL fallback). */
export async function dropPhysicalTableColumn(
  supabase: SupabaseClient,
  tableName: string,
  columnName: string
) {
  const table = normalizeDynamicTableName(tableName)

  const { error: rpcError } = await supabase.rpc('drop_registered_table_column', {
    p_table_name: table,
    p_column_name: columnName,
  })

  if (!rpcError) return { error: null as null }
  if (!isMissingRpcError(rpcError)) return { error: rpcError }

  const sql = generateDropColumnSQL(tableName, columnName)
  return runTableSqlAdmin(sql)
}
