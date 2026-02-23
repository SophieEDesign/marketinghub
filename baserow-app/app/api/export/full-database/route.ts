import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTables } from '@/lib/crud/tables'
import { getTableFields } from '@/lib/fields/schema'
import { getOptionValueToLabelMap, isSelectField } from '@/lib/fields/select-options'
import type { TableField } from '@/types/fields'

export async function GET() {
  try {
    const tables = await getTables()
    const supabase = await createClient()

    const exportData: {
      exportedAt: string
      tables: Array<{
        id: string
        name: string
        supabase_table: string
        data: Record<string, unknown>[]
      }>
    } = {
      exportedAt: new Date().toISOString(),
      tables: [],
    }

    for (const table of tables) {
      if (!table.supabase_table) continue

      const { data, error } = await supabase
        .from(table.supabase_table)
        .select('*')

      if (error) {
        console.warn(`Skipping table ${table.name} (${table.supabase_table}):`, error.message)
        exportData.tables.push({
          id: table.id,
          name: table.name || 'Unnamed',
          supabase_table: table.supabase_table,
          data: [],
        })
        continue
      }

      const rows = (data || []) as Record<string, unknown>[]

      // Load field metadata for human-readable select labels
      let fields: TableField[] = []
      try {
        fields = await getTableFields(table.id)
      } catch {
        // Use raw values if field metadata unavailable
      }

      const selectFieldMaps = new Map<string, Map<string, string>>()
      for (const f of fields) {
        if (isSelectField(f)) {
          const map = getOptionValueToLabelMap(f.type, f.options || null)
          selectFieldMaps.set(f.name, map)
        }
      }

      const transformValue = (columnName: string, value: unknown): unknown => {
        const map = selectFieldMaps.get(columnName)
        if (!map) return value
        if (value === null || value === undefined) return null
        if (!Array.isArray(value)) {
          const key = String(value)
          return map.get(key) ?? key
        }
        return value.map((v) => {
          const key = String(v)
          return map.get(key) ?? key
        })
      }

      const transformedRows = rows.map((row) => {
        const out: Record<string, unknown> = {}
        for (const [key, val] of Object.entries(row)) {
          out[key] = transformValue(key, val)
        }
        return out
      })

      exportData.tables.push({
        id: table.id,
        name: table.name || 'Unnamed',
        supabase_table: table.supabase_table,
        data: transformedRows,
      })
    }

    const json = JSON.stringify(exportData, null, 2)
    const filename = `database-export-${new Date().toISOString().slice(0, 10)}.json`

    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    })
  } catch (error: unknown) {
    console.error('Error exporting full database:', error)
    const message =
      (error as { message?: string })?.message || 'Failed to export database'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
