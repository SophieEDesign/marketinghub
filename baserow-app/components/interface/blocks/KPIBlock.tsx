"use client"

import type { CSSProperties } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import type { PageBlock } from "@/lib/interface/types"
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react"
import type { FilterConfig } from "@/lib/interface/filters"
import type { FilterTree } from "@/lib/filters/canonical-model"
import { useMarketingDashboard } from "@/contexts/MarketingDashboardContext"
import { resolveKpiIcon } from "@/lib/ui/content-icons"
import BlockHeader from "@/components/interface/blocks/shared/BlockHeader"

interface KPIBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageId?: string | null // Page ID
  filters?: FilterConfig[] // Page-level filters
  filterTree?: FilterTree
  aggregateData?: { data: any; error: string | null; isLoading: boolean } // Pre-fetched aggregate data (page-level)
}

interface ComparisonData {
  current: number | null
  previous: number | null
  change: number | null
  changePercent: number | null
  trend: 'up' | 'down' | 'neutral'
}

function formatKpiValue(value: number, format: string, aggregate: string): string {
  if (format === "compact") {
    return new Intl.NumberFormat(undefined, {
      notation: "compact",
      maximumFractionDigits: aggregate === "avg" ? 1 : 0,
    }).format(value)
  }
  if (format === "decimal") {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }
  if (format === "percent") {
    return `${new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value)}%`
  }
  if (aggregate === "avg") {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }
  return value.toLocaleString()
}

export default function KPIBlock({
  block,
  isEditing = false,
  pageId = null,
  filters = [],
  filterTree = null,
  aggregateData,
}: KPIBlockProps) {
  const router = useRouter()
  const marketingDashboardStyle = useMarketingDashboard()
  const isEditorialKpi = Boolean(marketingDashboardStyle)
  const { config } = block
  // KPI block MUST have table_id configured - no fallback to page table
  const tableId = config?.table_id
  const field = config?.kpi_field
  const aggregate = config?.kpi_aggregate || "count"
  const label = config?.kpi_label || config?.title || "KPI"
  const comparison = config?.comparison
  const target = config?.target_value
  const clickThrough = config?.click_through
  const iconName = config?.icon ?? config?.kpi_icon
  const KpiIcon = resolveKpiIcon(iconName)
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
  
  const getBackgroundColor = (): string | undefined => {
    if (appearance.background_color) return appearance.background_color
    switch (appearance.background) {
      case "tinted":
        return "#E8FFEA"
      case "emphasised":
        return "#FFE8EC"
      case "subtle":
        return "#FFF3E0"
      case "none":
      default:
        return undefined
    }
  }

  const useCardShell =
    !appearance.background_color &&
    (appearance.background === undefined || appearance.background === "none")

  const getTextColor = (): string | undefined => {
    if (appearance.text_color) return appearance.text_color
    if (appearance.title_color) return appearance.title_color
    const bgColor = getBackgroundColor()
    if (!bgColor) return undefined
    return "#111827"
  }

  // Get border radius
  const getBorderRadius = () => {
    if (isEditorialKpi) return "14px"
    if (appearance.border_radius !== undefined) return `${appearance.border_radius}px`
    if (appearance.radius === 'rounded') return '8px'
    return '8px' // Default rounded
  }

  // Get padding
  const getPadding = () => {
    if (isEditorialKpi) return "18px"
    if (typeof appearance.padding === 'number') return `${appearance.padding}px`
    if (appearance.padding === 'compact') return '12px'
    if (appearance.padding === 'spacious') return '24px'
    return '16px' // Default normal
  }

  const bgColorResolved = getBackgroundColor()
  const blockStyle: CSSProperties = {
    ...(bgColorResolved ? { backgroundColor: bgColorResolved } : {}),
    ...(appearance.border_color ? { borderColor: appearance.border_color } : {}),
    borderWidth:
      appearance.border_width !== undefined
        ? `${appearance.border_width}px`
        : appearance.border === "none"
          ? "0px"
          : "1px",
    borderRadius: getBorderRadius(),
    padding: getPadding(),
  }

  const displayLabel = appearance.title || label
  const showTitle = appearance.show_title !== false && displayLabel && displayLabel !== label

  const numberFormat = appearance.number_format || "standard"
  const showTrend = appearance.show_trend !== false
  const displayValue = value !== null 
    ? formatKpiValue(value, numberFormat, aggregate)
    : "—"

  const isClickable = clickThrough && !isEditing

  // Get value size class
  const getValueSizeClass = () => {
    if (isEditorialKpi) return "text-4xl"
    switch (appearance.value_size) {
      case 'small': return 'text-2xl'
      case 'medium': return 'text-3xl'
      case 'xlarge': return 'text-5xl'
      case 'large':
      default: return 'text-4xl'
    }
  }

  // Get alignment class
  const getAlignmentClass = () => {
    switch (appearance.alignment) {
      case 'left': return 'text-left items-start'
      case 'right': return 'text-right items-end'
      case 'center':
      default: return 'text-center items-center'
    }
  }

  const textColor = getTextColor()

  const hideChromeBorder =
    appearance.border === "none" ||
    (typeof appearance.border_width === "number" && appearance.border_width === 0)

  const marketingCardStyle: CSSProperties | undefined = marketingDashboardStyle
    ? {
        borderColor: "rgba(0,0,0,0.06)",
        borderWidth: "1px",
        backgroundColor: "#ffffff",
        boxShadow: "0 1px 2px rgba(16,24,40,0.04), 0 4px 12px rgba(16,24,40,0.04)",
      }
    : undefined

  return (
    <div
      className={cn(
        "relative flex h-full w-full max-w-full min-w-0 flex-col rounded-card",
        !hideChromeBorder && "border border-border",
        useCardShell && !appearance.border_color && (marketingDashboardStyle ? "bg-background shadow-none" : "bg-card shadow-card"),
        isClickable &&
          "cursor-pointer transition-shadow duration-200 hover:shadow-card-hover",
        isEditorialKpi && "min-h-[100px] overflow-visible"
      )}
      style={{ ...blockStyle, ...marketingCardStyle }}
      onClick={handleClick}
    >
      {(useCardShell || isEditorialKpi) && (
        <div
          className={cn(
            "pointer-events-none absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-gradient-to-r from-chart-1 via-chart-3 to-chart-5",
            isEditorialKpi ? "opacity-35" : "opacity-70"
          )}
          aria-hidden
        />
      )}
      {showTitle && (
        <BlockHeader
          title={displayLabel}
          className={cn(marketingDashboardStyle ? "mb-1.5" : "mb-2", !appearance.header_text_color && !textColor && "text-foreground")}
        />
      )}
      <div className="flex-1 flex items-center">
        {KpiIcon ? (
          <div className={cn("mr-2.5 inline-flex shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground", marketingDashboardStyle ? "h-7 w-7" : "h-8 w-8")}>
            <KpiIcon className={cn("opacity-80", marketingDashboardStyle ? "h-3.5 w-3.5" : "h-4 w-4")} aria-hidden />
          </div>
        ) : null}
        <div className={`flex-1 flex flex-col justify-center ${getAlignmentClass()}`}>
          <div className={`w-full ${getAlignmentClass().includes('text-center') ? 'text-center' : getAlignmentClass().includes('text-left') ? 'text-left' : 'text-right'}`}>
          {!showTitle && (
            <div className={`flex items-center gap-1.5 ${isEditorialKpi ? "mb-2" : "mb-3"} ${getAlignmentClass().includes('text-center') ? 'justify-center' : getAlignmentClass().includes('text-left') ? 'justify-start' : 'justify-end'}`}>
              {isEditorialKpi && (
                <span
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-muted/50"
                  aria-hidden
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400/60" />
                </span>
              )}
              <p
                className={cn(
                  isEditorialKpi ? "text-xs font-medium tracking-wide uppercase text-gray-500 whitespace-nowrap truncate" : "text-sm font-medium",
                  !textColor && "text-muted-foreground"
                )}
                style={textColor ? { color: textColor } : undefined}
              >
                {displayLabel}
              </p>
            </div>
          )}
          <p
            className={cn(
              getValueSizeClass(),
              isEditorialKpi ? "font-semibold mb-0 tracking-tight text-gray-900 leading-tight whitespace-nowrap" : "font-bold mb-2 tracking-tight",
              !textColor && "text-foreground"
            )}
            style={textColor ? { color: textColor } : undefined}
          >
            {displayValue}
          </p>
          
          {/* Comparison indicator */}
          {!isEditorialKpi && showTrend && comparisonData && comparisonData.change !== null && (
            <div className={`flex items-center gap-1 text-xs mb-0.5 ${getAlignmentClass().includes('text-center') ? 'justify-center' : getAlignmentClass().includes('text-left') ? 'justify-start' : 'justify-end'}`}>
              {comparisonData.trend === 'up' ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : comparisonData.trend === 'down' ? (
                <TrendingDown className="h-4 w-4 text-red-600" />
              ) : null}
              <span className={comparisonData.trend === 'up' ? 'text-green-600' : comparisonData.trend === 'down' ? 'text-red-600' : 'text-muted-foreground'}>
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
          {!isEditorialKpi && target !== undefined && target !== null && value !== null && (
            <div
              className={cn("text-xs mt-1", !textColor && "text-muted-foreground")}
              style={textColor ? { color: textColor, opacity: marketingDashboardStyle ? 0.72 : 0.85 } : undefined}
            >
              Target: {typeof target === 'number' ? target.toLocaleString() : target}
              {typeof target === 'number' && (
                <span className={value >= target ? ' text-green-600' : ' text-red-600'}>
                  {' '}({((value / target) * 100).toFixed(0)}%)
                </span>
              )}
            </div>
          )}

          {!isEditorialKpi && aggregate !== "count" && field && (
            <p
              className={cn("text-xs mt-1", !textColor && "text-muted-foreground", marketingDashboardStyle ? "opacity-75" : "opacity-90")}
              style={textColor ? { color: textColor, opacity: marketingDashboardStyle ? 0.65 : 0.75 } : undefined}
            >
              {aggregate.toUpperCase()} of {field}
            </p>
          )}

          {/* Click-through hint */}
          {!isEditorialKpi && isClickable && (
            <div
              className={cn(
                "mt-1.5 flex items-center gap-1 text-xs text-muted-foreground",
                getAlignmentClass().includes("text-center")
                  ? "justify-center"
                  : getAlignmentClass().includes("text-left")
                    ? "justify-start"
                    : "justify-end"
              )}
              style={textColor ? { color: textColor, opacity: marketingDashboardStyle ? 0.55 : 0.65 } : undefined}
            >
              <span>Click to view records</span>
              <ArrowRight className="h-3 w-3" />
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
