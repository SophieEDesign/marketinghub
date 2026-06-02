"use client"

import { useEffect, useMemo, useState } from "react"
import { parseISO } from "date-fns"
import type { PageBlock } from "@/lib/interface/types"
import {
  collectFilterOptions,
  filterContentTimelineItems,
  formatPeriodLabel,
  getContentTimelineMockItems,
  itemOverlapsView,
  shiftAnchorDate,
  type ContentTimelineFilters,
  type ContentTimelineGroupBy,
  type ContentTimelineView,
} from "@/lib/marketing/content-timeline"
import { useContentTimelineData } from "@/hooks/useContentTimelineData"
import {
  isMarketingMockEnabled,
  marketingDemoState,
  MARKETING_DEMO_BANNER_DEFAULT,
} from "@/lib/marketing/block-config-resolver"
import { useRecordModal } from "@/contexts/RecordModalContext"
import DashboardEmpty from "@/components/interface/primitives/DashboardEmpty"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { ContentTimelineDetailPanel } from "@/components/interface/content-timeline/ContentTimelineDetailPanel"
import { ContentTimelineFilterBar } from "@/components/interface/content-timeline/ContentTimelineFilterBar"
import { ContentTimelineGrid } from "@/components/interface/content-timeline/ContentTimelineGrid"
import { ContentTimelineHeader } from "@/components/interface/content-timeline/ContentTimelineHeader"
import { ContentTimelineStatusLegend } from "@/components/interface/content-timeline/ContentTimelineStatusLegend"
import MarketingDemoDataBanner from "@/components/interface/primitives/MarketingDemoDataBanner"
import { marketingBlockRootClass } from "@/lib/interface/marketing-block-layout"

interface ContentTimelineBlockProps {
  block: PageBlock
  isEditing?: boolean
  interfaceMode?: "view" | "edit"
  isFullPage?: boolean
}

const EMPTY_FILTERS: ContentTimelineFilters = {
  themes: [],
  types: [],
  channels: [],
  statuses: [],
  owners: [],
  divisions: [],
  search: "",
}

export default function ContentTimelineBlock({
  block,
  isEditing = false,
  interfaceMode = "view",
  isFullPage = false,
}: ContentTimelineBlockProps) {
  const { config } = block
  const { openRecordModal } = useRecordModal()
  const {
    loading,
    error,
    fromLiveData,
    hasTable,
    items: liveItems,
    reload,
  } = useContentTimelineData({ config, excludeEventTypes: true })

  const title = config?.title || "Content Timeline"
  const subtitle =
    config?.content_timeline_subtitle ||
    "Plan campaigns, posts, pages and marketing activity by theme."

  const defaultView = (config?.content_timeline_default_view || "quarter") as ContentTimelineView
  const groupBy = (config?.content_timeline_group_by || "theme") as ContentTimelineGroupBy
  const showFilters = config?.content_timeline_show_filters !== false
  const showStatusBadges = config?.content_timeline_show_status_badges !== false
  const showOwnerInitials = config?.content_timeline_show_owner_initials !== false
  const enableDetailPanel = config?.content_timeline_enable_detail_panel !== false
  const configCompact = config?.content_timeline_compact_mode === true
  const preset = config?.content_timeline_preset
  const isMarketingHomePreset = preset === "marketing_home"
  const forceMock = isMarketingMockEnabled(config, "content_timeline_use_mock")
  const mockItems = getContentTimelineMockItems(preset)
  const showFooterLink = config?.content_timeline_show_footer_link !== false
  const footerLabel =
    config?.content_timeline_footer_link_label || "View full calendar →"
  const showSearch = config?.content_timeline_show_search !== false
  const maxItems =
    typeof config?.content_timeline_max_items === "number"
      ? config.content_timeline_max_items
      : undefined

  const demoState = marketingDemoState({
    forceMock,
    fromLiveData,
    hasTable,
    error,
  })
  const allItems = demoState.useDemoData
    ? mockItems
    : demoState.useLiveData
      ? maxItems != null
        ? liveItems.slice(0, maxItems)
        : liveItems
      : []
  const isDemoData = demoState.useDemoData
  const demoBannerMessage = demoState.showDemoBanner
    ? forceMock
      ? demoState.bannerMessage
      : MARKETING_DEMO_BANNER_DEFAULT
    : ""

  const [view, setView] = useState<ContentTimelineView>(defaultView)
  const [anchorDate, setAnchorDate] = useState(() => new Date())
  const [compact, setCompact] = useState(configCompact)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filters, setFilters] = useState<ContentTimelineFilters>(() => ({
    ...EMPTY_FILTERS,
    themes: config?.content_timeline_default_theme_filter
      ? [config.content_timeline_default_theme_filter]
      : [],
  }))

  useEffect(() => {
    if (demoState.useLiveData) {
      setAnchorDate(new Date())
    } else if (!isMarketingHomePreset) {
      setAnchorDate(parseISO("2025-05-21T12:00:00"))
    }
  }, [isMarketingHomePreset, demoState.useLiveData])

  const showAddButton = demoState.useLiveData

  const filterOptions = useMemo(
    () => collectFilterOptions(allItems),
    [allItems]
  )

  const visibleItems = useMemo(() => {
    const inView = allItems.filter((item) =>
      itemOverlapsView(item, view, anchorDate)
    )
    return filterContentTimelineItems(inView, filters)
  }, [allItems, view, anchorDate, filters])

  const selectedItem = useMemo(
    () => allItems.find((i) => i.id === selectedId) ?? null,
    [allItems, selectedId]
  )

  const periodLabel = formatPeriodLabel(view, anchorDate)

  const handleFiltersChange = (patch: Partial<ContentTimelineFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }))
  }

  const handleClearFilters = () => {
    setFilters({ ...EMPTY_FILTERS })
  }

  const handleOpenRecord = (recordId: string) => {
    const item = allItems.find((i) => i.id === recordId)
    if (!item?.recordTableId || !item.recordSupabaseTable) return
    openRecordModal({
      tableId: item.recordTableId,
      recordId,
      supabaseTableName: item.recordSupabaseTable,
      interfaceMode,
      recordLayoutType: "content",
      onRecordUpdated: () => reload(),
    })
  }

  const handleSelectItem = (id: string) => {
    const item = allItems.find((candidate) => candidate.id === id)
    if (item?.recordTableId && item.recordSupabaseTable) {
      handleOpenRecord(id)
      return
    }
    setSelectedId((prev) => (prev === id ? null : id))
  }

  const handleAddContent = () => {
    const first = liveItems[0]
    if (!first?.recordTableId || !first.recordSupabaseTable) return
    openRecordModal({
      tableId: first.recordTableId,
      recordId: null,
      supabaseTableName: first.recordSupabaseTable,
      interfaceMode,
      recordLayoutType: "content",
      onRecordUpdated: () => reload(),
    })
  }

  if (loading && !demoState.useLiveData && !forceMock) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center rounded-2xl border border-border/40 bg-background">
        <LoadingSpinner size="lg" text="Loading content timeline…" />
      </div>
    )
  }

  if (demoState.showEmptyState && !demoState.useDemoData) {
    return (
      <div
        data-block-selectable
        className="flex h-full min-h-[200px] flex-col overflow-hidden rounded-2xl border border-border/40 bg-background"
      >
        <ContentTimelineHeader
          title={title}
          subtitle={subtitle}
          periodLabel=""
          view={view}
          showAddButton={false}
          onViewChange={() => {}}
          onPrevPeriod={() => {}}
          onNextPeriod={() => {}}
        />
        <DashboardEmpty
          title="No timeline data"
          description={demoState.bannerMessage}
          variant="default"
        />
      </div>
    )
  }

  return (
    <div
      data-block-selectable
      className={marketingBlockRootClass(
        isFullPage,
        "rounded-2xl border border-border/40 bg-background shadow-sm"
      )}
    >
      {isDemoData ? <MarketingDemoDataBanner message={demoBannerMessage} /> : null}

      <ContentTimelineHeader
        title={title}
        subtitle={subtitle}
        periodLabel={periodLabel}
        view={view}
        showAddButton={showAddButton}
        onViewChange={setView}
        onPrevPeriod={() => setAnchorDate((d) => shiftAnchorDate(view, d, -1))}
        onNextPeriod={() => setAnchorDate((d) => shiftAnchorDate(view, d, 1))}
        onAddContent={handleAddContent}
      />

      {showFilters && (
        <ContentTimelineFilterBar
          filters={filters}
          themeOptions={filterOptions.themes}
          typeOptions={filterOptions.types}
          channelOptions={filterOptions.channels}
          statusOptions={filterOptions.statuses}
          ownerOptions={filterOptions.owners}
          divisionOptions={filterOptions.divisions}
          compact={compact}
          onFiltersChange={handleFiltersChange}
          onClear={handleClearFilters}
          onCompactChange={setCompact}
        />
      )}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {visibleItems.length === 0 ? (
            <div className="flex h-full min-h-[200px] items-center justify-center p-6">
              <DashboardEmpty
                title="No content in this period"
                description="Try adjusting filters or navigating to another date range."
                variant="inline"
              />
            </div>
          ) : (
            <ContentTimelineGrid
              items={visibleItems}
              view={view}
              anchorDate={anchorDate}
              groupBy={groupBy}
              selectedId={selectedId}
              compact={compact}
              showStatusBadges={showStatusBadges}
              showOwnerInitials={showOwnerInitials}
              onSelect={handleSelectItem}
            />
          )}
        </div>

        {enableDetailPanel && selectedItem && !isEditing && (
          <ContentTimelineDetailPanel
            item={selectedItem}
            onClose={() => setSelectedId(null)}
            onOpenRecord={
              selectedItem.recordTableId ? () => handleOpenRecord(selectedItem.id) : undefined
            }
          />
        )}
      </div>

      {showFooterLink ? (
        <div className="shrink-0 border-t border-border/40 px-4 py-2.5">
          <button
            type="button"
            className="text-xs font-medium text-[#6D4AFF] hover:underline"
            onClick={() => {
              // TODO: Navigate to full Content / Social calendar page when wired.
            }}
          >
            {footerLabel}
          </button>
        </div>
      ) : null}

      {!isMarketingHomePreset ? <ContentTimelineStatusLegend /> : null}
    </div>
  )
}
