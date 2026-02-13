import { createClient } from '@/lib/supabase/server'
import { executeAutomation } from './engine'
import type { Automation } from '@/types/database'
import type { TriggerType } from './types'

export type RecordTriggerType = 'row_created' | 'row_updated' | 'row_deleted'

/**
 * Find and execute automations that are triggered by record create/update/delete.
 * Call this after a record is created, updated, or deleted.
 *
 * @param tableId - The tables.id (our internal table ID) that the record belongs to
 * @param triggerType - The type of record event
 * @param record - The record data (new record for create, updated record for update, deleted record for delete)
 * @param oldRecord - For row_updated only: the record before the update
 */
export async function runRecordAutomations(
  tableId: string,
  triggerType: RecordTriggerType,
  record: Record<string, any>,
  oldRecord?: Record<string, any>
): Promise<{ executed: number; errors: string[] }> {
  const supabase = await createClient()
  const errors: string[] = []
  let executed = 0

  try {
    const { data: automations, error } = await supabase
      .from('automations')
      .select('*')
      .eq('enabled', true)
      .eq('trigger_type', triggerType)

    if (error) {
      console.error('Error loading record automations:', error)
      return { executed: 0, errors: [error.message] }
    }

    if (!automations || automations.length === 0) {
      return { executed: 0, errors: [] }
    }

    // Filter to automations for this specific table
    const matching = (automations as Automation[]).filter(
      (a) => (a.trigger_config?.table_id || a.table_id) === tableId
    )

    for (const automation of matching) {
      try {
        const eventData: Record<string, any> = {
          record: { ...record },
          ...(oldRecord && { old_record: { ...oldRecord } }),
        }
        const result = await executeAutomation(automation, eventData)
        if (result.success) {
          executed++
        } else {
          errors.push(`Automation ${automation.name}: ${result.error}`)
        }
      } catch (err: any) {
        errors.push(`Automation ${automation.name}: ${err.message}`)
      }
    }

    return { executed, errors }
  } catch (err: any) {
    console.error('Error in runRecordAutomations:', err)
    return { executed: 0, errors: [err.message] }
  }
}

/**
 * Resolve supabase table name to our internal table_id.
 * Use when you only have the raw Supabase table name (e.g. from bulk-update).
 */
export async function getTableIdFromSupabaseTable(
  supabaseTableName: string
): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tables')
    .select('id')
    .eq('supabase_table', supabaseTableName)
    .maybeSingle()
  if (error || !data) return null
  return data.id
}
