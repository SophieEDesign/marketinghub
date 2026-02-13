import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  runRecordAutomations,
  getTableIdFromSupabaseTable,
  type RecordTriggerType,
} from '@/lib/automations/record-trigger'

/**
 * POST /api/automations/trigger-record
 *
 * Trigger record-based automations (row_created, row_updated, row_deleted).
 * Call this after a record is created, updated, or deleted - either from client
 * code or from Supabase Database Webhooks.
 *
 * Body:
 * - tableId?: string (our tables.id - use when known)
 * - supabaseTableName?: string (raw table name - use to look up tableId)
 * - triggerType: 'row_created' | 'row_updated' | 'row_deleted'
 * - record: Record (the record data)
 * - oldRecord?: Record (for row_updated: the record before the update)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const {
      tableId,
      supabaseTableName,
      triggerType,
      record,
      oldRecord,
    } = body as {
      tableId?: string
      supabaseTableName?: string
      triggerType?: string
      record?: Record<string, any>
      oldRecord?: Record<string, any>
    }

    const validTriggerTypes: RecordTriggerType[] = [
      'row_created',
      'row_updated',
      'row_deleted',
    ]
    if (
      !triggerType ||
      !validTriggerTypes.includes(triggerType as RecordTriggerType)
    ) {
      return NextResponse.json(
        {
          error: `triggerType must be one of: ${validTriggerTypes.join(', ')}`,
        },
        { status: 400 }
      )
    }

    if (!record || typeof record !== 'object') {
      return NextResponse.json(
        { error: 'record is required and must be an object' },
        { status: 400 }
      )
    }

    let resolvedTableId = tableId
    if (!resolvedTableId && supabaseTableName) {
      resolvedTableId =
        (await getTableIdFromSupabaseTable(supabaseTableName)) || undefined
    }

    if (!resolvedTableId) {
      return NextResponse.json(
        {
          error:
            'Either tableId or supabaseTableName must be provided, and must resolve to a valid table',
        },
        { status: 400 }
      )
    }

    const result = await runRecordAutomations(
      resolvedTableId,
      triggerType as RecordTriggerType,
      record,
      oldRecord
    )

    return NextResponse.json({
      success: true,
      executed: result.executed,
      errors: result.errors,
    })
  } catch (error: any) {
    console.error('Error triggering record automations:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to trigger automations' },
      { status: 500 }
    )
  }
}
