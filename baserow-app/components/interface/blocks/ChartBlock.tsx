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

  // Simple chart rendering (in production, use a charting library like recharts)
  return (
    <div className="h-full p-4">
      <div className="h-full border border-gray-200 rounded-lg p-4 flex items-center justify-center">
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
