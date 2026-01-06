"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { PageBlock } from "@/lib/interface/types"
import { applyFiltersToQuery, mergeFilters, type FilterConfig } from "@/lib/interface/filters"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon } from "lucide-react"

interface ChartBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageTableId?: string | null // Table ID from the page
  pageId?: string | null // Page ID
  filters?: FilterConfig[] // Page-level filters
}

interface ChartDataPoint {
  name: string
  value: number
  [key: string]: any
}

export default function ChartBlock({ block, isEditing = false, pageTableId = null, pageId = null, filters = [] }: ChartBlockProps) {
  const router = useRouter()
  const { config } = block
  // Chart block MUST have table_id configured - no fallback to page table
  const tableId = config?.table_id
  const chartType = config?.chart_type || "bar"
  const xAxis = config?.chart_x_axis
  const yAxis = config?.chart_y_axis
  const groupBy = config?.group_by_field
  const metric = config?.metric_field || yAxis
  const clickThrough = config?.click_through
  
  const [rawData, setRawData] = useState<any[]>([])
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tableFields, setTableFields] = useState<Array<{ name: string; type: string }>>([])
  
  // Apply filters with proper precedence:
  // 1. Block base filters (config.filters) - always applied
  // 2. Filter block filters (filters prop) - narrows results
  const blockBaseFilters = config?.filters || []
  const filterBlockFilters = filters || []
  const allFilters = useMemo(() => {
    return mergeFilters(blockBaseFilters, filterBlockFilters, [])
  }, [blockBaseFilters, filterBlockFilters])

  useEffect(() => {
    if (tableId) {
      loadTableFields()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId])

  useEffect(() => {
    if (tableId && xAxis && metric) {
      loadData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, xAxis, yAxis, groupBy, metric, allFilters])

  async function loadTableFields() {
    if (!tableId) return
    
    try {
      const supabase = createClient()
      const { data: fields } = await supabase
        .from("table_fields")
        .select("name, type")
        .eq("table_id", tableId)
      
      if (fields) {
        setTableFields(fields.map(f => ({ name: f.name, type: f.type })))
      }
    } catch (err) {
      console.error("Error loading table fields:", err)
    }
  }

  async function loadData() {
    if (!tableId || !xAxis || !metric) return

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Get table name
      const { data: table } = await supabase
        .from("tables")
        .select("supabase_table")
        .eq("id", tableId)
        .single()

      if (!table?.supabase_table) {
        throw new Error("Table not found")
      }

      // Load data with selected fields
      const fieldsToSelect = [xAxis, metric]
      if (groupBy && !fieldsToSelect.includes(groupBy)) {
        fieldsToSelect.push(groupBy)
      }

      // Build query with filters
      let query = supabase
        .from(table.supabase_table)
        .select(fieldsToSelect.join(", "))
        .limit(1000)

      // Apply filters using shared filter system
      query = applyFiltersToQuery(query, allFilters, tableFields)

      const { data: rows, error: fetchError } = await query

      if (fetchError) throw fetchError

      setRawData(rows || [])
      
      // Process data for chart
      const processed = processChartData(rows || [], xAxis, metric, groupBy)
      setChartData(processed)
    } catch (err: any) {
      console.error("Error loading chart data:", err)
      setError(err.message || "Failed to load chart data")
    } finally {
      setLoading(false)
    }
  }

  function processChartData(
    rows: any[],
    xField: string,
    yField: string,
    groupByField?: string
  ): ChartDataPoint[] {
    if (!rows || rows.length === 0) return []

    // If grouping, aggregate by group
    if (groupByField) {
      const grouped: Record<string, number> = {}
      
      rows.forEach((row) => {
        const groupValue = String(row[groupByField] || "Unknown")
        const yValue = parseFloat(row[yField]) || 0
        
        if (!grouped[groupValue]) {
          grouped[groupValue] = 0
        }
        grouped[groupValue] += yValue
      })

      return Object.entries(grouped).map(([name, value]) => ({
        name,
        value,
      }))
    }

    // Simple aggregation by x-axis value
    const aggregated: Record<string, number> = {}
    
    rows.forEach((row) => {
      const xValue = String(row[xField] || "Unknown")
      const yValue = parseFloat(row[yField]) || 0
      
      if (!aggregated[xValue]) {
        aggregated[xValue] = 0
      }
      aggregated[xValue] += yValue
    })

    return Object.entries(aggregated)
      .map(([name, value]) => ({
        name: name.length > 20 ? name.substring(0, 20) + "..." : name,
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20) // Limit to top 20 for readability
  }

  function handleChartClick(data: any) {
    if (clickThrough && !isEditing && tableId) {
      // Navigate to filtered view
      if (clickThrough.view_id) {
        router.push(`/tables/${tableId}/views/${clickThrough.view_id}`)
      } else {
        router.push(`/tables/${tableId}`)
      }
    }
  }

  function renderChart() {
    // Color palette for charts
    const COLORS = [
      '#0088FE', '#00C49F', '#FFBB28', '#FF8042',
      '#8884d8', '#82ca9d', '#ffc658', '#ff7300',
      '#8dd1e1', '#d084d0', '#ffb347', '#87ceeb'
    ]

    switch (chartType) {
      case "bar":
        return (
          <BarChart data={chartData} onClick={handleChartClick}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              angle={-45}
              textAnchor="end"
              height={80}
              interval={0}
            />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill={COLORS[0]} />
          </BarChart>
        )
      case "line":
        return (
          <LineChart data={chartData} onClick={handleChartClick}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={80}
              interval={0}
            />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={2} />
          </LineChart>
        )
      case "pie":
        return (
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              onClick={handleChartClick}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        )
      case "stacked_bar":
        return (
          <BarChart data={chartData} onClick={handleChartClick}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={80}
              interval={0}
            />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" stackId="a" fill={COLORS[0]} />
          </BarChart>
        )
      default:
        // Default to bar chart if unknown type
        return (
          <BarChart data={chartData} onClick={handleChartClick}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              angle={-45}
              textAnchor="end"
              height={80}
              interval={0}
            />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill={COLORS[0]} />
          </BarChart>
        )
    }
  }

  // Empty state - block requires table_id in config
  if (!tableId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <BarChart3 className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="mb-2">{isEditing ? "This block requires a table connection." : "No table connection"}</p>
          {isEditing && (
            <p className="text-xs text-gray-400">Configure the table in block settings.</p>
          )}
        </div>
      </div>
    )
  }
  
  if (!xAxis || !metric) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <BarChart3 className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="mb-2">{isEditing ? "Configure chart settings" : "No chart configuration"}</p>
          {isEditing && (
            <p className="text-xs text-gray-400">Select X-axis and metric fields in block settings.</p>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mx-auto mb-2"></div>
          <p className="text-sm">Loading chart data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-1">Error loading chart</p>
          <p className="text-xs">{error}</p>
        </div>
      </div>
    )
  }

  if (chartData.length === 0) {
  return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <BarChart3 className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="mb-1">No data available</p>
          <p className="text-xs text-gray-400">Try adjusting filters or date range</p>
        </div>
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
  const showTitle = appearance.show_title !== false && title

  return (
    <div 
      className={`h-full w-full overflow-auto flex flex-col ${clickThrough && !isEditing ? 'cursor-pointer' : ''}`}
      style={blockStyle}
    >
      {showTitle && (
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
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
      {clickThrough && !isEditing && (
        <div className="text-xs text-gray-400 text-center mt-2">
          Click chart to view records
        </div>
      )}
    </div>
  )
}
