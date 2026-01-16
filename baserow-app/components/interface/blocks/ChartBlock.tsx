"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { AggregateType, PageBlock } from "@/lib/interface/types"
import { applyFiltersToQuery, mergeFilters, type FilterConfig } from "@/lib/interface/filters"
import { computeFormulaFields } from "@/lib/formulas/computeFormulaFields"
import type { TableField } from "@/types/fields"
import {
  resolveChoiceColor,
  getTextColorForBackground,
  normalizeHexColor,
} from "@/lib/field-colors"
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
  color?: string
  [key: string]: any
}

interface CategoricalLegendItem {
  category: string
  count: number
  percentage: number
  color: string
}

export default function ChartBlock({ block, isEditing = false, pageTableId = null, pageId = null, filters = [] }: ChartBlockProps) {
  const router = useRouter()
  const { config } = block
  // Chart block MUST have table_id configured - no fallback to page table
  const tableId = config?.table_id
  const chartType = config?.chart_type || "bar"
  // Explicitly type metricType so comparisons against "count" are valid in TS.
  const metricType: AggregateType = (config?.chart_aggregate as AggregateType) || "count"
  const metricField = config?.metric_field
  const groupBy = config?.group_by_field
  // X-axis is inferred from Group By when Group By is selected
  // Otherwise use explicit chart_x_axis
  const xAxis = groupBy ? groupBy : config?.chart_x_axis
  const clickThrough = config?.click_through
  
  const [rawData, setRawData] = useState<any[]>([])
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [categoricalData, setCategoricalData] = useState<CategoricalLegendItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tableFields, setTableFields] = useState<TableField[]>([])
  const [tableName, setTableName] = useState<string | null>(null)
  
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
    // Load data when we have:
    // - Table ID
    // - Metric type (always required)
    // - For non-count metrics: metric field is required
    // - For count metrics: group by / x-axis are optional (single "All" bucket is allowed)
    // - For non-count metrics without group by: xAxis field is required
    const isCountMetric = String(metricType) === "count"
    const hasRequiredConfig = tableId && metricType && (
      isCountMetric || metricField
    ) && (
      isCountMetric || // Count can render without group/x-axis (single bucket)
      (!isCountMetric && (groupBy || xAxis)) // Non-count: group by or x-axis required
    )
    
    if (hasRequiredConfig) {
      loadData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, metricType, metricField, groupBy, xAxis, chartType, allFilters])

  async function loadTableFields() {
    if (!tableId) return
    
    try {
      const supabase = createClient()
      const { data: fields } = await supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", tableId)
        .order("position")
      
      if (fields) {
        setTableFields(fields as TableField[])
      }
    } catch (err) {
      console.error("Error loading table fields:", err)
    }
  }

  async function loadData() {
    // Validation: ensure we have required configuration
    if (!tableId || !metricType) return
    if (metricType !== "count" && !metricField) return
    // For non-count metrics, we need a category axis (groupBy or xAxis). Count can render as a single bucket.
    if (metricType !== "count" && !groupBy && !xAxis) return

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Get table name
      const { data: table } = await supabase
        .from("tables")
        .select("supabase_table, name")
        .eq("id", tableId)
        .single()

      if (!table?.supabase_table) {
        throw new Error("Table not found")
      }
      if (table?.name) {
        setTableName(String(table.name))
      }

      // Determine which fields we need to select
      const xAxisField = xAxis ? tableFields.find(f => f.name === xAxis) : null
      const metricFieldDef = metricField ? tableFields.find(f => f.name === metricField) : null
      const groupByFieldDef = groupBy ? tableFields.find(f => f.name === groupBy) : null
      
      // Collect all formula fields for computation
      const allFormulaFields = tableFields.filter(f => f.type === 'formula')
      
      // Determine if we need to compute formula fields
      const needsFormulaComputation = allFormulaFields.length > 0 && 
        (xAxisField?.type === 'formula' || metricFieldDef?.type === 'formula' || groupByFieldDef?.type === 'formula')
      
      // Select fields - for count with group by, we only need group by field
      let selectFields: string
      if (needsFormulaComputation) {
        selectFields = '*' // Select all to ensure formula dependencies are available
      } else {
        const fieldsToSelect = new Set<string>()
        if (xAxis) fieldsToSelect.add(xAxis)
        if (metricField) fieldsToSelect.add(metricField)
        if (groupBy && groupBy !== xAxis) fieldsToSelect.add(groupBy)
        selectFields = Array.from(fieldsToSelect).join(", ") || "*"
      }

      // Build query with filters
      let query = supabase
        .from(table.supabase_table)
        .select(selectFields)
        .limit(1000)

      // Apply filters using shared filter system
      query = applyFiltersToQuery(query, allFilters, tableFields)

      const { data: rows, error: fetchError } = await query

      if (fetchError) throw fetchError

      // Compute formula fields if needed
      let processedRows: any[] = rows || []
      if (needsFormulaComputation && processedRows.length > 0) {
        processedRows = processedRows.map(row => {
          return computeFormulaFields(row, allFormulaFields, tableFields)
        }) as any[]
      }

      setRawData(processedRows)
      
      // Process data for chart
      const processed = processChartData(processedRows, metricType, metricField, xAxis, groupBy)
      
      if (processed.length === 0 && processedRows.length > 0) {
        console.warn("Chart data processing resulted in empty dataset", {
          metricType,
          metricField,
          xAxis,
          groupBy,
          rowCount: processedRows.length,
          sampleRow: processedRows[0]
        })
      }
      
      setChartData(processed)
      setCategoricalData([])
    } catch (err: any) {
      console.error("Error loading chart data:", err)
      const errorMessage = err.message || "Failed to load chart data"
      setError(errorMessage)
      
      // Log additional debugging info
      console.error("Chart block error details:", {
        tableId,
        metricType,
        metricField,
        xAxis,
        groupBy,
        error: errorMessage
      })
    } finally {
      setLoading(false)
    }
  }

  function processCategoricalLegendData(
    rows: any[],
    categoryField: string
  ): CategoricalLegendItem[] {
    if (!rows || rows.length === 0) return []

    const sampleRow = rows[0]
    if (!sampleRow || !(categoryField in sampleRow)) {
      console.warn(`Category field "${categoryField}" not found in data`)
      return []
    }

    // Find the field definition to get color information
    const categoryFieldDef = tableFields.find(f => f.name === categoryField)
    const isMultiSelect = categoryFieldDef?.type === 'multi_select'
    
    // Count occurrences of each category
    const categoryCounts: Record<string, number> = {}
    let totalCount = 0

    rows.forEach((row) => {
      const value = row[categoryField]
      
      if (isMultiSelect && Array.isArray(value)) {
        // For multi-select, count each selected value
        value.forEach((val: string) => {
          if (val) {
            const category = String(val)
            categoryCounts[category] = (categoryCounts[category] || 0) + 1
            totalCount++
          }
        })
      } else if (value) {
        // For single-select, count the single value
        const category = String(value)
        categoryCounts[category] = (categoryCounts[category] || 0) + 1
        totalCount++
      }
    })

    // Convert to array with colors and percentages
    const result: CategoricalLegendItem[] = Object.entries(categoryCounts)
      .map(([category, count]) => {
        // Get color for this category
        const color = categoryFieldDef
          ? resolveChoiceColor(
              category,
              isMultiSelect ? 'multi_select' : 'single_select',
              categoryFieldDef.options,
              !isMultiSelect
            )
          : '#3B82F6' // Default blue fallback

        return {
          category,
          count,
          percentage: totalCount > 0 ? (count / totalCount) * 100 : 0,
          color,
        }
      })
      .sort((a, b) => b.count - a.count) // Sort by count descending

    return result
  }

  function processChartData(
    rows: any[],
    aggregateType: string,
    metricFieldName: string | undefined,
    xAxisFieldName: string | undefined,
    groupByFieldName?: string
  ): ChartDataPoint[] {
    if (!rows || rows.length === 0) return []

    // Validate that required fields exist in the data
    const sampleRow = rows[0]
    if (!sampleRow) return []
    
    const categoryField = groupByFieldName || xAxisFieldName
    if (categoryField && !(categoryField in sampleRow)) {
      console.warn(`Category field "${categoryField}" not found in data`)
      return []
    }
    if (aggregateType !== "count" && metricFieldName && !(metricFieldName in sampleRow)) {
      console.warn(`Metric field "${metricFieldName}" not found in data`)
      return []
    }

    // Aggregate data by category (group by or x-axis)
    const aggregated: Record<string, number[]> = {}
    
    rows.forEach((row) => {
      const categoryValue = categoryField ? String(row[categoryField] ?? "Unknown") : "All"
      
      if (!aggregated[categoryValue]) {
        aggregated[categoryValue] = []
      }
      
      if (aggregateType === "count") {
        // For count, just add 1 for each row
        aggregated[categoryValue].push(1)
      } else if (metricFieldName) {
        // For other aggregates, collect numeric values
        const value = parseFloat(String(row[metricFieldName] ?? 0))
        if (!isNaN(value) && value !== null && value !== undefined) {
          aggregated[categoryValue].push(value)
        }
      }
    })

    // Apply aggregation function to each category
    const result: ChartDataPoint[] = Object.entries(aggregated).map(([name, values]) => {
      let value = 0
      
      if (values.length === 0) {
        value = 0
      } else if (aggregateType === "count") {
        value = values.length
      } else if (aggregateType === "sum") {
        value = values.reduce((a, b) => a + b, 0)
      } else if (aggregateType === "avg") {
        value = values.reduce((a, b) => a + b, 0) / values.length
      } else if (aggregateType === "min") {
        value = Math.min(...values)
      } else if (aggregateType === "max") {
        value = Math.max(...values)
      }
      
      return {
        name: name.length > 30 ? name.substring(0, 30) + "..." : name,
        value: Math.round(value * 100) / 100, // Round to 2 decimal places
      }
    })

    // Sort by value descending and limit to top 20
    return result
      .sort((a, b) => b.value - a.value)
      .slice(0, 20)
  }

  function handleChartClick(data: any) {
    if (clickThrough && !isEditing && tableId) {
      // Build URL with filters and group by (match KPI behavior)
      const params = new URLSearchParams()
      
      // Start with block filters
      let filtersToApply = [...blockBaseFilters]
      
      // Apply group by filter if we have group by and clicked data point
      if (groupBy && data?.name) {
        filtersToApply.push({
          field: groupBy,
          operator: 'equal',
          value: data.name
        })
      }
      
      if (filtersToApply.length > 0) {
        params.set('filters', JSON.stringify(filtersToApply))
      }
      
      const queryString = params.toString()
      const url = clickThrough.view_id
        ? `/tables/${tableId}/views/${clickThrough.view_id}${queryString ? `?${queryString}` : ''}`
        : `/tables/${tableId}${queryString ? `?${queryString}` : ''}`
      
      router.push(url)
    }
  }

  function renderCategoricalLegend() {
    if (categoricalData.length === 0) {
      return (
        <div className="h-full flex items-center justify-center text-gray-400 text-sm">
          No categories found
        </div>
      )
    }

    const totalCount = categoricalData.reduce((sum, item) => sum + item.count, 0)

    return (
      <div className="h-full w-full p-4 overflow-auto">
        <div className="space-y-3">
          {categoricalData.map((item) => {
            const bgColor = normalizeHexColor(item.color)
            const textColorClass = getTextColorForBackground(bgColor)
            
            return (
              <div
                key={item.category}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
              >
                {/* Color indicator */}
                <div
                  className="w-12 h-12 rounded-md flex-shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: bgColor }}
                >
                  <span className={`text-xs font-semibold ${textColorClass}`}>
                    {item.percentage.toFixed(0)}%
                  </span>
                </div>
                
                {/* Category info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap ${textColorClass}`}
                      style={{ backgroundColor: bgColor }}
                    >
                      {item.category}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {item.count.toLocaleString()} {item.count === 1 ? 'item' : 'items'}
                  </div>
                </div>
                
                {/* Percentage bar */}
                <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: bgColor,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
        
        {/* Total count */}
        <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600 text-center">
          Total: {totalCount.toLocaleString()} {totalCount === 1 ? 'item' : 'items'}
        </div>
      </div>
    )
  }

  function renderChart() {
    // Color palette for charts
    const COLORS = [
      '#0088FE', '#00C49F', '#FFBB28', '#FF8042',
      '#8884d8', '#82ca9d', '#ffc658', '#ff7300',
      '#8dd1e1', '#d084d0', '#ffb347', '#87ceeb'
    ]

    // Generate Y-axis label based on metric type
    const getYAxisLabel = () => {
      if (metricType === "count") return "Count"
      const metricLabel = metricField || "Value"
      const aggregateLabels: Record<string, string> = {
        sum: `Sum of ${metricLabel}`,
        avg: `Avg of ${metricLabel}`,
        min: `Min of ${metricLabel}`,
        max: `Max of ${metricLabel}`,
      }
      return aggregateLabels[metricType] || metricLabel
    }

    const yAxisLabel = getYAxisLabel()
    const xAxisLabel = groupBy || xAxis || "Category"

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
              label={{ value: xAxisLabel, position: 'insideBottom', offset: -5 }}
            />
            <YAxis label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }} />
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
              label={{ value: xAxisLabel, position: 'insideBottom', offset: -5 }}
            />
            <YAxis label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }} />
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
              label={{ value: xAxisLabel, position: 'insideBottom', offset: -5 }}
            />
            <YAxis label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }} />
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
              label={{ value: xAxisLabel, position: 'insideBottom', offset: -5 }}
            />
            <YAxis label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }} />
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
  
  // Validation: check if configuration is complete
  const isConfigComplete = metricType && (
    String(metricType) === "count" || metricField
  ) && (
    String(metricType) === "count" || groupBy || xAxis
  )
  
  if (!isConfigComplete) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <BarChart3 className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="mb-2">{isEditing ? "Choose how you want to measure your data" : "No chart configuration"}</p>
          {isEditing && (
            <p className="text-xs text-gray-400">
              {!metricType 
                ? "Select a metric type (e.g., Count records) in block settings."
                : String(metricType) !== "count" && !metricField
                ? "Select a field to measure in block settings."
                : "Select how to group or categorize your data in block settings."}
            </p>
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

  // Check for empty data (categorical legend functionality removed - was incomplete)
  if (chartData.length === 0 && !loading) {
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

  // View mode: show only a "table title" (table name or appearance.title), not the block's config.title.
  const title = appearance.title || (isEditing ? config.title : tableName)
  const showTitle = (appearance.showTitle ?? (appearance as any).show_title) !== false && title

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
      {/* Recharts needs a non-zero height; min-height ensures charts render even in auto-height layouts. */}
      <div className="flex-1 min-h-[260px]">
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
