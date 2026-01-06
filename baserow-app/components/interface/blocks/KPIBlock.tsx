"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import type { PageBlock } from "@/lib/interface/types"
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react"
import { type FilterConfig } from "@/lib/interface/filters"

interface KPIBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageTableId?: string | null // Table ID from the page
  pageId?: string | null // Page ID
  filters?: FilterConfig[] // Page-level filters
}

interface ComparisonData {
  current: number | null
  previous: number | null
  change: number | null
  changePercent: number | null
  trend: 'up' | 'down' | 'neutral'
}

export default function KPIBlock({ block, isEditing = false, pageTableId = null, pageId = null, filters = [] }: KPIBlockProps) {
  const router = useRouter()
  const { config } = block
  // Use page's tableId if block doesn't have one configured
  const tableId = config?.table_id || pageTableId
  const field = config?.kpi_field
  const aggregate = config?.kpi_aggregate || "count"
  const label = config?.kpi_label || config?.title || "KPI"
  const comparison = config?.comparison
  const target = config?.target_value
  const clickThrough = config?.click_through
  
  const [value, setValue] = useState<number | null>(null)
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Merge page filters with block filters
  const blockFilters = config?.filters || []
  const allFilters = useMemo(() => {
    // Merge filters - block filters override page filters for same field
    const merged: FilterConfig[] = [...filters]
    for (const blockFilter of blockFilters) {
      const existingIndex = merged.findIndex(f => f.field === blockFilter.field)
      if (existingIndex >= 0) {
        merged[existingIndex] = blockFilter as FilterConfig
      } else {
        merged.push(blockFilter as FilterConfig)
      }
    }
    return merged
  }, [filters, blockFilters])

  useEffect(() => {
    if (tableId) {
      loadKPI()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, field, aggregate, comparison, allFilters])

  async function loadKPI() {
    if (!tableId) return

    setLoading(true)
    setError(null)

    try {
      // Use server-side aggregation API
      const response = await fetch('/api/dashboard/aggregate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId,
          aggregate,
          fieldName: field,
          filters: allFilters, // Use merged filters
          comparison: comparison ? {
            dateFieldName: comparison.date_field,
            currentStart: comparison.current_start,
            currentEnd: comparison.current_end,
            previousStart: comparison.previous_start,
            previousEnd: comparison.previous_end,
          } : undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load KPI')
      }

      // Handle comparison response
      if (comparison && data.current !== undefined) {
        setComparisonData(data)
        setValue(data.current)
      } else {
        setValue(data.value)
      }
    } catch (error: any) {
      console.error("Error loading KPI:", error)
      setError(error.message || 'Failed to load KPI')
    } finally {
      setLoading(false)
    }
  }

  function handleClick() {
    if (clickThrough && !isEditing) {
      // Navigate to filtered view
      if (clickThrough.view_id) {
        router.push(`/tables/${tableId}/views/${clickThrough.view_id}`)
      } else if (tableId) {
        router.push(`/tables/${tableId}`)
      }
    }
  }

  // Empty state
  if (!tableId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-2">{isEditing ? "This block isn't connected to a table yet." : "No table connection"}</p>
          {isEditing && (
            <p className="text-xs text-gray-400">Configure the table in block settings, or ensure the page has a table connection.</p>
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
          <p className="text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-1">Error loading data</p>
          <p className="text-xs">{error}</p>
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

  const displayLabel = appearance.title || label
  const showTitle = appearance.show_title !== false && displayLabel && displayLabel !== label

  const displayValue = value !== null 
    ? (aggregate === "avg" ? value.toFixed(2) : value.toLocaleString())
    : "—"

  const isClickable = clickThrough && !isEditing

  return (
    <div 
      className={`h-full w-full overflow-auto flex flex-col ${isClickable ? 'cursor-pointer' : ''}`}
      style={blockStyle}
      onClick={handleClick}
    >
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
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="text-center w-full">
          {!showTitle && (
            <p className="text-sm mb-2" style={{ color: appearance.title_color }}>
              {displayLabel}
            </p>
          )}
          <p className="text-3xl font-bold mb-2" style={{ color: appearance.title_color || '#111827' }}>
            {displayValue}
          </p>
          
          {/* Comparison indicator */}
          {comparisonData && comparisonData.change !== null && (
            <div className="flex items-center justify-center gap-1 text-sm mb-1">
              {comparisonData.trend === 'up' ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : comparisonData.trend === 'down' ? (
                <TrendingDown className="h-4 w-4 text-red-600" />
              ) : null}
              <span className={comparisonData.trend === 'up' ? 'text-green-600' : comparisonData.trend === 'down' ? 'text-red-600' : 'text-gray-600'}>
                {comparisonData.changePercent !== null && comparisonData.changePercent !== 0 && (
                  <>
                    {comparisonData.changePercent > 0 ? '+' : ''}
                    {comparisonData.changePercent.toFixed(1)}%
                  </>
                )}
              </span>
            </div>
          )}

          {/* Target comparison */}
          {target !== undefined && target !== null && value !== null && (
            <div className="text-xs text-gray-500 mt-1">
              Target: {typeof target === 'number' ? target.toLocaleString() : target}
              {typeof target === 'number' && (
                <span className={value >= target ? ' text-green-600' : ' text-red-600'}>
                  {' '}({((value / target) * 100).toFixed(0)}%)
                </span>
              )}
            </div>
          )}

          {aggregate !== "count" && field && (
            <p className="text-xs mt-1" style={{ color: appearance.title_color || '#6b7280' }}>
              {aggregate.toUpperCase()} of {field}
            </p>
          )}

          {/* Click-through hint */}
          {isClickable && (
            <div className="mt-3 flex items-center justify-center gap-1 text-xs text-gray-400">
              <span>Click to view records</span>
              <ArrowRight className="h-3 w-3" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
