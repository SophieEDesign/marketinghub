"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { PageBlock } from "@/lib/interface/types"
import { TrendingUp, TrendingDown } from "lucide-react"

interface KPIBlockProps {
  block: PageBlock
  isEditing?: boolean
}

export default function KPIBlock({ block, isEditing = false }: KPIBlockProps) {
  const { config } = block
  const tableId = config?.table_id
  const field = config?.kpi_field
  const aggregate = config?.kpi_aggregate || "count"
  const label = config?.kpi_label || config?.title || "KPI"
  const [value, setValue] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (tableId) {
      loadKPI()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, field, aggregate])

  async function loadKPI() {
    if (!tableId) return

    setLoading(true)
    const supabase = createClient()

    // Get table name
    const { data: table } = await supabase
      .from("tables")
      .select("supabase_table")
      .eq("id", tableId)
      .single()

    if (!table?.supabase_table) {
      setLoading(false)
      return
    }

    try {
      if (aggregate === "count") {
        const { count } = await supabase
          .from(table.supabase_table)
          .select("*", { count: "exact", head: true })

        setValue(count || 0)
      } else if (field) {
        // For other aggregates, we'd need to use RPC or calculate client-side
        const { data: rows } = await supabase
          .from(table.supabase_table)
          .select(field)
          .limit(1000)

        if (rows && rows.length > 0) {
          const values = rows.map((r: any) => parseFloat(r[field]) || 0).filter((v: number) => !isNaN(v))

          if (aggregate === "sum") {
            setValue(values.reduce((a, b) => a + b, 0))
          } else if (aggregate === "avg") {
            setValue(values.reduce((a, b) => a + b, 0) / values.length)
          } else if (aggregate === "min") {
            setValue(Math.min(...values))
          } else if (aggregate === "max") {
            setValue(Math.max(...values))
          }
        }
      }
    } catch (error) {
      console.error("Error loading KPI:", error)
    }

    setLoading(false)
  }

  if (!tableId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        {isEditing ? "Configure KPI settings" : "No data"}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        Loading...
      </div>
    )
  }

  // Apply appearance settings
  const appearance = config.appearance || {}
  const blockStyle: React.CSSProperties = {
    backgroundColor: appearance.background_color,
    borderColor: appearance.border_color,
    borderWidth: appearance.border_width !== undefined ? `${appearance.border_width}px` : '1px',
    borderRadius: appearance.border_radius !== undefined ? `${appearance.border_radius}px` : '8px',
    padding: appearance.padding !== undefined ? `${appearance.padding}px` : '16px',
  }

  const displayLabel = appearance.title || label
  const showTitle = appearance.show_title !== false && displayLabel && displayLabel !== label

  return (
    <div className="h-full w-full overflow-auto flex flex-col" style={blockStyle}>
      {showTitle && (
        <div
          className="mb-4 pb-2 border-b"
          style={{
            backgroundColor: appearance.header_background,
            color: appearance.header_text_color || appearance.title_color,
          }}
        >
          <h3 className="text-lg font-semibold">{displayLabel}</h3>
        </div>
      )}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center">
          {!showTitle && (
            <p className="text-sm mb-2" style={{ color: appearance.title_color }}>
              {displayLabel}
            </p>
          )}
          <p className="text-3xl font-bold" style={{ color: appearance.title_color || '#111827' }}>
            {value !== null ? (
              aggregate === "avg" ? value.toFixed(2) : value.toLocaleString()
            ) : (
              "—"
            )}
          </p>
          {aggregate !== "count" && field && (
            <p className="text-xs mt-1" style={{ color: appearance.title_color || '#6b7280' }}>
              {aggregate.toUpperCase()} of {field}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
