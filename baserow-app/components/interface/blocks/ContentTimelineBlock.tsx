"use client"

import { useMemo, useState } from "react"
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
import DashboardEmpty from "@/components/interface/primitives/DashboardEmpty"
import { ContentTimelineDetailPanel } from "@/components/interface/content-timeline/ContentTimelineDetailPanel"
import { ContentTimelineFilterBar } from "@/components/interface/content-timeline/ContentTimelineFilterBar"
import { ContentTimelineGrid } from "@/components/interface/content-timeline/ContentTimelineGrid"
import { ContentTimelineHeader } from "@/components/interface/content-timeline/ContentTimelineHeader"
import { ContentTimelineStatusLegend } from "@/components/interface/content-timeline/ContentTimelineStatusLegend"

interface ContentTimelineBlockProps {
  block: PageBlock
  isEditing?: boolean
  interfaceMode?: "view" | "edit"
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
}: ContentTimelineBlockProps) {
  const { config } = block
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
  const mockItems = getContentTimelineMockItems(preset)
  const showFooterLink = config?.content_timeline_show_footer_link !== false
  const footerLabel =
    config?.content_timeline_footer_link_label || "View full calendar →"

  const [view, setView] = useState<ContentTimelineView>(defaultView)
  const [anchorDate, setAnchorDate] = useState(() =>
    parseISO(isMarketingHomePreset ? "2025-05-14T12:00:00" : "2025-05-21T12:00:00")
  )
  const [compact, setCompact] = useState(configCompact)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filters, setFilters] = useState<ContentTimelineFilters>(() => ({
    ...EMPTY_FILTERS,
    themes: config?.content_timeline_default_theme_filter
      ? [config.content_timeline_default_theme_filter]
      : [],
  }))

  const showAddButton = isEditing || interfaceMode === "edit"

  const filterOptions = useMemo(
    () => collectFilterOptions(mockItems),
    [mockItems]
  )

  const visibleItems = useMemo(() => {
    const inView = mockItems.filter((item) =>
      itemOverlapsView(item, view, anchorDate)
    )
    return filterContentTimelineItems(inView, filters)
  }, [mockItems, view, anchorDate, filters])

  const selectedItem = useMemo(
    () => mockItems.find((i) => i.id === selectedId) ?? null,
    [mockItems, selectedId]
  )

  const periodLabel = formatPeriodLabel(view, anchorDate)

  const handleFiltersChange = (patch: Partial<ContentTimelineFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }))
  }

  const handleClearFilters = () => {
    setFilters({ ...EMPTY_FILTERS })
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/40 bg-background shadow-sm">
      <ContentTimelineHeader
        title={title}
        subtitle={subtitle}
        periodLabel={periodLabel}
        view={view}
        showAddButton={showAddButton}
        onViewChange={setView}
        onPrevPeriod={() => setAnchorDate((d) => shiftAnchorDate(view, d, -1))}
        onNextPeriod={() => setAnchorDate((d) => shiftAnchorDate(view, d, 1))}
        onAddContent={() => {
          // TODO: support permissions for who can add/edit content.
        }}
      />

      {showFilters && (
        <ContentTimelineFilterBar
          filters={filters}
          ownerOptions={filterOptions.owners}
          divisionOptions={filterOptions.divisions}
          compact={compact}
          onFiltersChange={handleFiltersChange}
          onClear={handleClearFilters}
          onCompactChange={setCompact}
        />
      )}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
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
              onSelect={(id) => setSelectedId((prev) => (prev === id ? null : id))}
            />
          )}
        </div>

        {enableDetailPanel && selectedItem && (
          <ContentTimelineDetailPanel item={selectedItem} onClose={() => setSelectedId(null)} />
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
