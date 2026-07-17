import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTable } from '@/lib/crud/tables'
import { getTableFields } from '@/lib/fields/schema'
import { getOptionValueToLabelMap, isSelectField } from '@/lib/fields/select-options'
import type { TableField } from '@/types/fields'

export async function GET(
  request: NextRequest,
  { params }: { params: { tableId: string } }
) {
  try {
    const table = await getTable(params.tableId)
    if (!table || !table.supabase_table) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    }

    const supabase = await createClient()

    // Fetch all rows from the underlying Supabase table
    const { data, error } = await supabase
      .from(table.supabase_table)
      .select('*')

    if (error) {
      console.error('Error fetching table rows for CSV export:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to fetch table rows' },
        { status: 500 }
      )
    }

    const rows = (data || []) as Record<string, unknown>[]

    // Load field metadata so we can export human-readable labels for select fields.
    let fields: TableField[] = []
    try {
      fields = await getTableFields(table.id)
    } catch (e) {
      console.warn('Failed to load table fields for CSV export, falling back to raw values:', e)
    }

    const selectFieldMaps = new Map<string, Map<string, string>>()
    for (const f of fields) {
      if (isSelectField(f)) {
        const map = getOptionValueToLabelMap(f.type, f.options || null)
        selectFieldMaps.set(f.name, map)
      }
    }

    const transformValueForExport = (columnName: string, value: unknown): unknown => {
      const map = selectFieldMaps.get(columnName)
      if (!map) return value

      if (value === null || value === undefined) return ''

      // Single-select: stored as a single string (option id or label)
      if (!Array.isArray(value)) {
        const key = String(value)
        return map.get(key) ?? key
      }

      // Multi-select: stored as string[]
      const transformed = value.map((v) => {
        const key = String(v)
        return map.get(key) ?? key
      })
      return transformed
    }

    // If no rows, still return a CSV with just headers (from keys of an empty object)
    const headers =
      rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : []

    const escapeCsvValue = (value: unknown): string => {
      if (value === null || value === undefined) return ''
      if (Array.isArray(value)) {
        return `"${value.join(', ').replace(/"/g, '""')}"`
      }
      const str = String(value)
      // Wrap in quotes if contains comma, quote, or newline
      if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const lines: string[] = []
    if (headers.length > 0) {
      lines.push(headers.join(','))
      for (const row of rows as Record<string, unknown>[]) {
        const line = headers
          .map((key) => escapeCsvValue(transformValueForExport(key, row[key])))
          .join(',')
        lines.push(line)
      }
    }

    const csv = lines.join('\r\n')

    const filename = `${table.name || 'table'}-${new Date().toISOString().slice(0, 10)}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    })
  } catch (error: unknown) {
    console.error('Error exporting table to CSV:', error)
    const message =
      (error as { message?: string })?.message || 'Failed to export table to CSV'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

