"use client"

import { useRouter } from "next/navigation"
import type { PageBlock } from "@/lib/interface/types"
import { TrendingUp, TrendingDown, ArrowRight, Filter } from "lucide-react"
import type { FilterConfig } from "@/lib/interface/filters"

interface KPIBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageTableId?: string | null // Table ID from the page
  pageId?: string | null // Page ID
  filters?: FilterConfig[] // Page-level filters
  aggregateData?: { data: any; error: string | null; isLoading: boolean } // Pre-fetched aggregate data (page-level)
}

interface ComparisonData {
  current: number | null
  previous: number | null
  change: number | null
  changePercent: number | null
  trend: 'up' | 'down' | 'neutral'
}

export default function KPIBlock({ block, isEditing = false, pageTableId = null, pageId = null, filters = [], aggregateData }: KPIBlockProps) {
  const router = useRouter()
  const { config } = block
  // KPI block MUST have table_id configured - no fallback to page table
  const tableId = config?.table_id
  const field = config?.kpi_field
  const aggregate = config?.kpi_aggregate || "count"
  const label = config?.kpi_label || config?.title || "KPI"
  const comparison = config?.comparison
  const target = config?.target_value
  const clickThrough = config?.click_through
  const blockFilters = config?.filters || []
  const hasFilters = blockFilters.length > 0
  
  // CRITICAL: Use pre-fetched aggregate data if available (page-level fetching)
  // Fallback to local state only if aggregateData is not provided (backward compatibility)
  const hasPreFetchedData = aggregateData !== undefined
  
  // Extract value and comparison data from pre-fetched data
  const value = hasPreFetchedData && aggregateData?.data
    ? (comparison && aggregateData.data.current !== undefined 
        ? aggregateData.data.current 
        : aggregateData.data.value)
    : null
  
  const comparisonData: ComparisonData | null = hasPreFetchedData && aggregateData?.data && comparison
    ? {
        current: aggregateData.data.current ?? null,
        previous: aggregateData.data.previous ?? null,
        change: aggregateData.data.change ?? null,
        changePercent: aggregateData.data.changePercent ?? null,
        trend: aggregateData.data.trend || 'neutral',
      }
    : null
  
  const loading = hasPreFetchedData ? (aggregateData?.isLoading ?? false) : false
  const error = hasPreFetchedData ? aggregateData?.error : null

  function handleClick() {
    if (clickThrough && !isEditing) {
      // Navigate to filtered view with filters applied
      // Build URL with filter query params
      const params = new URLSearchParams()
      if (hasFilters) {
        params.set('filters', JSON.stringify(blockFilters))
      }
      const queryString = params.toString()
      const url = clickThrough.view_id
        ? `/tables/${tableId}/views/${clickThrough.view_id}${queryString ? `?${queryString}` : ''}`
        : tableId
          ? `/tables/${tableId}${queryString ? `?${queryString}` : ''}`
          : null
      if (url) {
        router.push(url)
      }
    }
  }

  // Empty state - block requires table_id in config
  if (!tableId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-2">{isEditing ? "This block requires a table connection." : "No table connection"}</p>
          {isEditing && (
            <p className="text-xs text-gray-400">Configure the table in block settings.</p>
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
            <div className="flex items-center justify-center gap-2 mb-2">
              <p className="text-sm" style={{ color: appearance.title_color }}>
                {displayLabel}
              </p>
              {hasFilters && isEditing && (
                <div className="group relative">
                  <Filter className="h-3 w-3 text-blue-600" />
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    This KPI is filtered ({blockFilters.length} filter{blockFilters.length !== 1 ? 's' : ''})
                  </div>
                </div>
              )}
            </div>
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
