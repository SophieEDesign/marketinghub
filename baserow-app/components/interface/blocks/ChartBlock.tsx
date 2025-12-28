"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { PageBlock } from "@/lib/interface/types"
import { BarChart3, LineChart, PieChart } from "lucide-react"

interface ChartBlockProps {
  block: PageBlock
  isEditing?: boolean
}

export default function ChartBlock({ block, isEditing = false }: ChartBlockProps) {
  const { config } = block
  const tableId = config?.table_id
  const chartType = config?.chart_type || "bar"
  const xAxis = config?.chart_x_axis
  const yAxis = config?.chart_y_axis
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (tableId) {
      loadData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, xAxis, yAxis])

  async function loadData() {
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

    // Load data
    const { data: rows } = await supabase
      .from(table.supabase_table)
      .select("*")
      .limit(100)

    setData(rows || [])
    setLoading(false)
  }

  if (!tableId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        {isEditing ? "Configure chart settings" : "No data"}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        Loading chart data...
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

  const title = appearance.title || config.title

  // Simple chart rendering (in production, use a charting library like recharts)
  return (
    <div className="h-full w-full overflow-auto" style={blockStyle}>
      {appearance.show_title !== false && title && (
        <div
          className="mb-4 pb-2 border-b"
          style={{
            backgroundColor: appearance.header_background,
            color: appearance.header_text_color || appearance.title_color,
          }}
        >
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
      )}
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          {chartType === "bar" && <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-2" />}
          {chartType === "line" && <LineChart className="h-12 w-12 mx-auto text-gray-400 mb-2" />}
          {chartType === "pie" && <PieChart className="h-12 w-12 mx-auto text-gray-400 mb-2" />}
          <p className="text-sm text-gray-500">
            {chartType.toUpperCase()} Chart
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {data.length} records
          </p>
          {isEditing && (
            <p className="text-xs text-gray-400 mt-2">
              Configure axes in settings
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
