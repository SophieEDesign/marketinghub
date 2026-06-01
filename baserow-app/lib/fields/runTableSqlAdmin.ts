import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Run DDL against dynamic data tables via execute_sql_safe.
 * Must use service role: execute_sql_safe is not granted to authenticated/anon
 * (see migration 20260421000002_restrict_dangerous_function_exec_grants.sql).
 */
export async function runTableSqlAdmin(sql_text: string) {
  const admin = createAdminClient()
  return admin.rpc('execute_sql_safe', { sql_text })
}

export async function notifyPostgrestSchemaReload() {
  try {
    await runTableSqlAdmin("NOTIFY pgrst, 'reload schema';")
    await new Promise((resolve) => setTimeout(resolve, 200))
  } catch {
    // Non-fatal: PostgREST will eventually pick up schema changes.
  }
}
