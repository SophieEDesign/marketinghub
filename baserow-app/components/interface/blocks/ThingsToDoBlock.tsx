"use client"

import { useCallback, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Filter } from "lucide-react"
import type { PageBlock } from "@/lib/interface/types"
import {
  collectFilterOptions,
  computeThingsToDoStats,
  EMPTY_THINGS_TO_DO_FILTERS,
  filterThingsToDoItems,
  getThingsToDoMockItems,
  groupThingsToDoItems,
  sortThingsToDoItems,
  type ThingsToDoGrouping,
  type ThingsToDoDateRange,
  type ThingsToDoFilters,
  type ThingsToDoSort,
  type ThingsToDoView,
} from "@/lib/marketing/things-to-do"
import { useThingsToDoData } from "@/hooks/useThingsToDoData"
import {
  isMarketingMockEnabled,
  marketingDemoState,
  MARKETING_DEMO_BANNER_DEFAULT,
} from "@/lib/marketing/block-config-resolver"
import { useRecordModal } from "@/contexts/RecordModalContext"
import DashboardEmpty from "@/components/interface/primitives/DashboardEmpty"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ThingsToDoFilterSidebar } from "@/components/interface/things-to-do/ThingsToDoFilterSidebar"
import { ThingsToDoGroupedList } from "@/components/interface/things-to-do/ThingsToDoGroupedList"
import { ThingsToDoHeader } from "@/components/interface/things-to-do/ThingsToDoHeader"
import { ThingsToDoListToolbar } from "@/components/interface/things-to-do/ThingsToDoListToolbar"
import { ThingsToDoViewTabs } from "@/components/interface/things-to-do/ThingsToDoViewTabs"
import MarketingDemoDataBanner from "@/components/interface/primitives/MarketingDemoDataBanner"
import { marketingBlockRootClass } from "@/lib/interface/marketing-block-layout"

interface ThingsToDoBlockProps {
  block: PageBlock
  isEditing?: boolean
  interfaceMode?: "view" | "edit"
  isFullPage?: boolean
}

export default function ThingsToDoBlock({
  block,
  isEditing = false,
  interfaceMode = "view",
  isFullPage = false,
}: ThingsToDoBlockProps) {
  const { config } = block
  const { openRecordModal } = useRecordModal()
  const { loading, error, fromLiveData, hasTable, items: liveItems, reload } =
    useThingsToDoData({ config })

  const title = config?.title || "Things To Do"
  const subtitle =
    config?.things_to_do_subtitle ||
    "Tasks, reviews, approvals and actions in one place."
  const defaultView = (config?.things_to_do_default_view || "list") as ThingsToDoView
  const showFilters = config?.things_to_do_show_filters !== false
  const showQuickLinks = config?.things_to_do_show_quick_links !== false
  const showStats = config?.things_to_do_show_stats !== false
  const compact = config?.things_to_do_compact_mode === true
  const maxItems = config?.things_to_do_max_items
  const dateRange = (config?.things_to_do_date_range || "next_30_days") as ThingsToDoDateRange
  const defaultGrouping = (config?.things_to_do_default_grouping ||
    "due-date") as ThingsToDoGrouping
  const forceMock = isMarketingMockEnabled(config, "things_to_do_use_mock")
  const mockItems = getThingsToDoMockItems()
  const demoState = marketingDemoState({ forceMock, fromLiveData, hasTable, error })
  const sourceItems = demoState.useDemoData
    ? mockItems
    : demoState.useLiveData
      ? liveItems
      : []
  const isDemoData = demoState.useDemoData
  const demoBannerMessage = demoState.showDemoBanner
    ? forceMock
      ? demoState.bannerMessage
      : MARKETING_DEMO_BANNER_DEFAULT
    : ""
  const showSearch = config?.things_to_do_show_search !== false

  const [view, setView] = useState<ThingsToDoView>(defaultView === "list" ? "list" : "list")
  const [filters, setFilters] = useState<ThingsToDoFilters>(EMPTY_THINGS_TO_DO_FILTERS)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<ThingsToDoSort>("due-date")
  const [statusChip, setStatusChip] = useState("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [desktopFiltersCollapsed, setDesktopFiltersCollapsed] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set())

  const filterOptions = useMemo(() => collectFilterOptions(sourceItems), [sourceItems])

  const filtered = useMemo(() => {
    let items = filterThingsToDoItems(sourceItems, filters, searchQuery, dateRange, statusChip)
    return sortThingsToDoItems(items, sortBy)
  }, [sourceItems, filters, searchQuery, dateRange, statusChip, sortBy])

  const stats = useMemo(() => computeThingsToDoStats(filtered), [filtered])

  const sections = useMemo(() => {
    let grouped = groupThingsToDoItems(filtered, defaultGrouping)
    if (maxItems != null && maxItems > 0) {
      let remaining = maxItems
      grouped = grouped
        .map((section) => {
          if (remaining <= 0) {
            return { ...section, items: [], count: 0 }
          }
          const items = section.items.slice(0, remaining)
          remaining -= items.length
          return { ...section, items, count: items.length }
        })
        .filter((s) => s.items.length > 0)
    }
    return grouped
  }, [filtered, defaultGrouping, maxItems])

  const selectedItem = useMemo(
    () => sourceItems.find((i) => i.id === selectedId) ?? null,
    [sourceItems, selectedId]
  )

  const handleFiltersChange = useCallback((patch: Partial<ThingsToDoFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }))
  }, [])

  const handleClearFilters = useCallback(() => {
    setFilters(EMPTY_THINGS_TO_DO_FILTERS)
  }, [])

  const handleCheckedChange = useCallback((id: string, checked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const handleOpenRecord = useCallback(
    (item = selectedItem) => {
      if (!item?.recordTableId || !item.recordSupabaseTable) return
      openRecordModal({
        tableId: item.recordTableId,
        recordId: item.id,
        supabaseTableName: item.recordSupabaseTable,
        interfaceMode,
        recordLayoutType: "task",
        onRecordUpdated: () => reload(),
      })
    },
    [selectedItem, openRecordModal, interfaceMode, reload]
  )

  const handleSelectItem = useCallback(
    (itemId: string) => {
      if (isEditing) return
      const item = sourceItems.find((candidate) => candidate.id === itemId)
      if (item?.recordTableId && item.recordSupabaseTable) {
        handleOpenRecord(item)
        return
      }
      setSelectedId(itemId)
    },
    [sourceItems, handleOpenRecord, isEditing]
  )

  if (demoState.showEmptyState && !demoState.useDemoData) {
    return (
      <div data-block-selectable className="flex h-full min-h-[200px] flex-col rounded-2xl border border-border/40 bg-background p-6">
        <ThingsToDoHeader
          title={title}
          subtitle={subtitle}
          stats={{
            overdue: 0,
            dueToday: 0,
            dueThisWeek: 0,
            waiting: 0,
            completed: 0,
          }}
          showStats={false}
        />
        <DashboardEmpty title="No tasks" description={demoState.bannerMessage} variant="default" />
      </div>
    )
  }

  if (loading && !demoState.useLiveData && !forceMock) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center rounded-2xl border border-border/40 bg-background">
        <LoadingSpinner size="lg" text="Loading things to do…" />
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

      <ThingsToDoHeader
        title={title}
        subtitle={subtitle}
        stats={stats}
        showStats={showStats}
        showAddButton
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {showFilters ? (
          <>
            <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2 lg:hidden">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => setFiltersOpen((o) => !o)}
              >
                <Filter className="mr-1.5 h-3.5 w-3.5" />
                Filters
              </Button>
            </div>
            <ThingsToDoFilterSidebar
              filters={filters}
              options={filterOptions}
              showQuickLinks={showQuickLinks}
              onFiltersChange={handleFiltersChange}
              onClear={handleClearFilters}
              className={cn(
                !filtersOpen && "hidden lg:flex",
                desktopFiltersCollapsed && "lg:hidden"
              )}
            />
          </>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {showFilters ? (
            <div className="hidden border-b border-border/40 px-4 py-2 lg:flex">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setDesktopFiltersCollapsed((v) => !v)}
              >
                {desktopFiltersCollapsed ? (
                  <>
                    <ChevronRight className="h-3.5 w-3.5" />
                    Show filters
                  </>
                ) : (
                  <>
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Hide filters
                  </>
                )}
              </Button>
            </div>
          ) : null}
          <ThingsToDoViewTabs view={view} onViewChange={setView} />

          {view === "list" ? (
            <>
              <ThingsToDoListToolbar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                sortBy={sortBy}
                onSortChange={setSortBy}
                statusChip={statusChip}
                onStatusChipChange={setStatusChip}
                totalCount={filtered.length}
                compact={compact}
              />

              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-2 md:p-3">
                  {filtered.length === 0 ? (
                    <DashboardEmpty
                      title="Nothing to do"
                      description="Try adjusting filters or search."
                      variant="default"
                    />
                  ) : (
                    <div className="flex h-full w-full min-w-0">
                      <ThingsToDoGroupedList
                        sections={sections}
                        selectedId={selectedId}
                        compact={compact}
                        checkedIds={checkedIds}
                        onSelect={handleSelectItem}
                        onCheckedChange={handleCheckedChange}
                        onOpenRecord={(item) => {
                          if (isEditing) return
                          setSelectedId(item.id)
                          handleOpenRecord(item)
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
