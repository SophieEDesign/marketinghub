'use client'

/**
 * Fire-and-forget: trigger record-based automations from client-side code.
 * Call after a successful create/update/delete via direct Supabase.
 * Does not block or throw; failures are logged to console.
 */
export function triggerRecordAutomations(
  tableId: string,
  triggerType: 'row_created' | 'row_updated' | 'row_deleted',
  record: Record<string, any>,
  oldRecord?: Record<string, any>
): void {
  fetch('/api/automations/trigger-record', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tableId,
      triggerType,
      record,
      ...(oldRecord && { oldRecord }),
    }),
  }).catch((err) => console.error('[Automation] trigger-record failed:', err))
}
