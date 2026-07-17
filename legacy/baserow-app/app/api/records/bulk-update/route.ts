import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/roles'
import { runRecordAutomations } from '@/lib/automations/record-trigger'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { table, recordIds, updates } = body

    if (!table || !recordIds || !Array.isArray(recordIds) || recordIds.length === 0) {
      return NextResponse.json(
        { error: 'table and recordIds array are required' },
        { status: 400 }
      )
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json(
        { error: 'updates object is required' },
        { status: 400 }
      )
    }

    // Check permissions - admins or members (editors) can bulk update
    const admin = await isAdmin()
    if (!admin) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }

      // Under RLS, non-admin users can only see their own profile,
      // but we still filter by user_id for clarity.
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()

      // Support both current (admin/member) and legacy (admin/editor/viewer) role strings.
      const role = profile?.role
      const canBulkUpdate = role === 'admin' || role === 'member' || role === 'editor'

      if (!canBulkUpdate) {
        return NextResponse.json(
          { error: 'Unauthorized. Member/editor or admin access required.' },
          { status: 403 }
        )
      }
    }

    // Get table info to validate fields
    const { data: tableInfo } = await supabase
      .from('tables')
      .select('id, supabase_table')
      .eq('supabase_table', table)
      .single()

    if (!tableInfo) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      )
    }

    // Get field definitions to validate and check permissions
    const { data: tableFields } = await supabase
      .from('table_fields')
      .select('name, type, options')
      .eq('table_id', tableInfo.id)

    const fieldMap = new Map(tableFields?.map((f: any) => [f.name, f]) || [])

    // Process updates - handle special operations
    const processedUpdates: Record<string, any> = {}

    for (const [fieldName, value] of Object.entries(updates)) {
      const field = fieldMap.get(fieldName)
      
      // Skip if field doesn't exist or is read-only
      if (!field || field.options?.read_only) {
        continue
      }

      // Skip virtual fields
      if (field.type === 'formula' || field.type === 'lookup') {
        continue
      }

      // Handle special operations
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if ('__append' in value) {
          // Append operation - fetch current values and append
          const { data: currentRows } = await supabase
            .from(table)
            .select(`id, ${fieldName}`)
            .in('id', recordIds)

          processedUpdates[fieldName] = currentRows?.map((row: any) => {
            const current = row[fieldName] || ''
            return String(current) + String(value.__append)
          })
          continue
        }

        if ('__add' in value) {
          // Add to multi-select
          const { data: currentRows } = await supabase
            .from(table)
            .select(`id, ${fieldName}`)
            .in('id', recordIds)

          processedUpdates[fieldName] = currentRows?.map((row: any) => {
            const current = Array.isArray(row[fieldName]) ? row[fieldName] : []
            const toAdd = Array.isArray(value.__add) ? value.__add : [value.__add]
            return [...new Set([...current, ...toAdd])]
          })
          continue
        }

        if ('__remove' in value) {
          // Remove from multi-select
          const { data: currentRows } = await supabase
            .from(table)
            .select(`id, ${fieldName}`)
            .in('id', recordIds)

          processedUpdates[fieldName] = currentRows?.map((row: any) => {
            const current = Array.isArray(row[fieldName]) ? row[fieldName] : []
            const toRemove = Array.isArray(value.__remove) ? value.__remove : [value.__remove]
            return current.filter((v: any) => !toRemove.includes(v))
          })
          continue
        }
      }

      // Regular set operation
      processedUpdates[fieldName] = value
    }

    if (Object.keys(processedUpdates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Fetch current values for append/add/remove operations
    const { data: currentRows } = await supabase
      .from(table)
      .select('*')
      .in('id', recordIds)

    if (!currentRows || currentRows.length === 0) {
      return NextResponse.json(
        { error: 'No records found to update' },
        { status: 404 }
      )
    }

    // Process updates per record for append/add/remove
    const updatesToApply = currentRows.map((row) => {
      const rowUpdates: Record<string, any> = {}
      
      for (const [fieldName, value] of Object.entries(processedUpdates)) {
        if (Array.isArray(value)) {
          // Per-row value from append/add/remove
          const rowIndex = currentRows.findIndex((r) => r.id === row.id)
          rowUpdates[fieldName] = value[rowIndex] ?? row[fieldName]
        } else {
          rowUpdates[fieldName] = value
        }
      }
      
      return { id: row.id, updates: rowUpdates }
    })

    // Perform bulk update in batches
    const batchSize = 100
    const batches = []
    for (let i = 0; i < updatesToApply.length; i += batchSize) {
      batches.push(updatesToApply.slice(i, i + batchSize))
    }

    const updatePromises = batches.map(async (batch) => {
      // Update each record individually for per-row values
      const promises = batch.map(({ id, updates }) =>
        supabase
          .from(table)
          .update(updates)
          .eq('id', id)
      )
      return Promise.all(promises)
    })

    await Promise.all(updatePromises)

    // Build old→new map for automation triggers
    const oldById = new Map(
      (currentRows || []).map((r: any) => [r.id, { ...r }])
    )

    // Fetch updated records
    const { data: updatedRecords, error: fetchError } = await supabase
      .from(table)
      .select('*')
      .in('id', recordIds)

    if (fetchError) {
      console.error('Error fetching updated records:', fetchError)
    }

    // Trigger row_updated automations for each record (fire-and-forget)
    if (updatedRecords && tableInfo?.id) {
      for (const row of updatedRecords) {
        const oldRecord = oldById.get(row.id)
        runRecordAutomations(
          tableInfo.id,
          'row_updated',
          row,
          oldRecord
        ).catch((err) => console.error('Automation trigger error:', err))
      }
    }

    return NextResponse.json({
      success: true,
      updated: recordIds.length,
      records: updatedRecords || [],
    })
  } catch (error: any) {
    console.error('Error in bulk update:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update records' },
      { status: 500 }
    )
  }
}

