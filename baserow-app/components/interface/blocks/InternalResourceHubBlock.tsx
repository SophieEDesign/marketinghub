"use client"

/**
 * Internal Resource Hub — visual media library block for internal staff.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import type { PageBlock } from "@/lib/interface/types"
import { useResourceHubData } from "@/hooks/useResourceHubData"
import { useRecordModal } from "@/contexts/RecordModalContext"
import { useEffectiveUserRole } from "@/contexts/MemberPreviewContext"
import { useUserRole } from "@/lib/hooks/useUserRole"
import {
  isMarketingMockEnabled,
  marketingDemoState,
  MARKETING_DEMO_BANNER_DEFAULT,
} from "@/lib/marketing/block-config-resolver"
import { FilterResultsAnnouncer } from "@/components/a11y/FilterResultsAnnouncer"
import DashboardEmpty from "@/components/interface/primitives/DashboardEmpty"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import HubHeader from "./internal-resource-hub/HubHeader"
import CategoryPills from "./internal-resource-hub/CategoryPills"
import ResourceGrid from "./internal-resource-hub/ResourceGrid"
import DetailPanel from "./internal-resource-hub/DetailPanel"
import {
  MARKETING_HOME_MOCK_RESOURCES,
  MOCK_RESOURCES,
} from "./internal-resource-hub/mock-data"
import ResourceList, { ResourceListHeader } from "./internal-resource-hub/ResourceList"
import {
  countByCategory,
  filterResources,
  getFeatured,
  getVariants,
  hasActiveFilters,
  parseDefaultCategory,
  sortResources,
  type ResourceSortMode,
} from "./internal-resource-hub/utils"
import type { CategoryFilter } from "./internal-resource-hub/types"
import MarketingDemoDataBanner from "@/components/interface/primitives/MarketingDemoDataBanner"
import {
  marketingBlockRootClass,
  marketingBlockScrollPanelClass,
} from "@/lib/interface/marketing-block-layout"
import { cn } from "@/lib/utils"

const FAVOURITES_STORAGE_KEY = "resource-hub-favourites"

interface InternalResourceHubBlockProps {
  block: PageBlock
  isEditing?: boolean
  interfaceMode?: "view" | "edit"
  onUpdate?: (updates: Partial<PageBlock["config"]>) => void
  isFullPage?: boolean
}

export default function InternalResourceHubBlock({
  block,
  isEditing = false,
  interfaceMode = "view",
  isFullPage = false,
}: InternalResourceHubBlockProps) {
  const { config } = block
  const title = config.title || "Brand & Media Resources"
  const subtitle =
    config.subtitle ||
    config.resource_hub_subtitle ||
    "Access official logos, brand assets, images and documents for internal use."
  const showSearch = config.resource_hub_show_search !== false
  const showFilters = config.resource_hub_show_filters !== false
  const layoutMode = config.resource_hub_layout_mode || "gallery"
  const isListLayout = layoutMode === "list"
  const forceMock = isMarketingMockEnabled(
    config,
    "resource_hub_use_mock",
    "resource_hub_use_dashboard_mock"
  )
  const maxItems = (() => {
    if (typeof config.record_limit === "number") return config.record_limit
    if (typeof config.resource_hub_max_items === "number") return config.resource_hub_max_items
    return undefined
  })()
  const showDetailPanel = config.resource_hub_show_detail_panel !== false
  const { openRecordModal, isRecordModalOpen } = useRecordModal()
  const { role: clientRole } = useUserRole()
  const effectiveRole = useEffectiveUserRole(clientRole)
  const { loading, error, fromLiveData, hasTable, tableIds, resources: liveResources, reload } =
    useResourceHubData({ config })

  const [category, setCategory] = useState<CategoryFilter>(() =>
    parseDefaultCategory(config.resource_hub_default_category)
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [favourites, setFavourites] = useState<Set<string>>(() => new Set())
  const [sortMode, setSortMode] = useState<ResourceSortMode>("recent")

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVOURITES_STORAGE_KEY)
      if (!raw) return
      const ids = JSON.parse(raw) as unknown
      if (Array.isArray(ids)) {
        setFavourites(new Set(ids.filter((id): id is string => typeof id === "string")))
      }
    } catch {
      // Ignore corrupt local storage
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify([...favourites]))
    } catch {
      // Ignore quota / privacy mode
    }
  }, [favourites])

  const demoState = marketingDemoState({ forceMock, fromLiveData, hasTable, error })
  const mockPool = config.resource_hub_use_dashboard_mock
    ? MARKETING_HOME_MOCK_RESOURCES
    : MOCK_RESOURCES
  const liveSlice =
    maxItems != null ? liveResources.slice(0, maxItems) : liveResources
  const resources = demoState.useDemoData
    ? mockPool
    : demoState.useLiveData
      ? liveSlice
      : []
  const isDemoData = demoState.useDemoData
  const demoBannerMessage = demoState.showDemoBanner
    ? forceMock
      ? demoState.bannerMessage
      : MARKETING_DEMO_BANNER_DEFAULT
    : ""
  const counts = useMemo(() => countByCategory(resources, favourites), [resources, favourites])
  const filteredBase = useMemo(
    () => filterResources(resources, category, searchQuery, favourites),
    [resources, category, searchQuery, favourites]
  )
  const filtered = useMemo(
    () => sortResources(filteredBase, sortMode),
    [filteredBase, sortMode]
  )
  const featured = useMemo(() => getFeatured(resources), [resources])
  const showFeaturedRow = category === "all" && !searchQuery.trim()
  const gridResources = useMemo(() => {
    if (!showFeaturedRow) return filtered
    const featuredIds = new Set(featured.map((f) => f.id))
    return filtered.filter((r) => !featuredIds.has(r.id))
  }, [filtered, featured, showFeaturedRow])
  const filtersActive = hasActiveFilters(category, searchQuery)
  const selected = useMemo(
    () => resources.find((r) => r.id === selectedId) ?? null,
    [resources, selectedId]
  )
  const variants = useMemo(
    () => (selected ? getVariants(resources, selected) : []),
    [resources, selected]
  )

  const handleSelect = useCallback(
    (id: string) => {
      if (isEditing) return
      setSelectedId(id)
    },
    [isEditing]
  )

  const handleBack = useCallback(() => {
    setSelectedId(null)
  }, [])

  const toggleFavouriteById = useCallback((id: string) => {
    setFavourites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleFavourite = useCallback(() => {
    if (!selectedId) return
    toggleFavouriteById(selectedId)
  }, [selectedId, toggleFavouriteById])

  const clearFilters = useCallback(() => {
    setCategory("all")
    setSearchQuery("")
  }, [])

  const heroImageUrl =
    typeof config.resource_hub_hero_url === "string" && config.resource_hub_hero_url.trim()
      ? config.resource_hub_hero_url.trim()
      : undefined

  const openResourceUrl = useCallback(
    (id: string) => {
      if (isEditing) return
      const r = resources.find((x) => x.id === id)
      if (r?.url) window.open(r.url, "_blank", "noopener,noreferrer")
    },
    [resources, isEditing]
  )

  const handleEditResourceDetails = useCallback(
    (id: string) => {
      if (isEditing || !tableIds) return
      openRecordModal({
        tableId: tableIds.mediaTableId,
        recordId: String(id),
        supabaseTableName: tableIds.mediaSupabaseTable,
        interfaceMode,
        recordLayoutType: "asset",
        initialDrawerMode: "edit",
        onRecordUpdated: () => reload(),
      })
    },
    [isEditing, tableIds, openRecordModal, interfaceMode, reload]
  )

  const showSideDetailPanel = showDetailPanel && !isRecordModalOpen && selected !== null

  const canCreateResource =
    effectiveRole === "admin" &&
    !isEditing &&
    demoState.useLiveData &&
    !forceMock &&
    !!tableIds?.mediaTableId
  const canManageSelectedResource =
    effectiveRole === "admin" &&
    !isEditing &&
    demoState.useLiveData &&
    !forceMock &&
    !!tableIds?.mediaTableId &&
    !!selectedId

  const handleCreateResource = useCallback(() => {
    if (!canCreateResource || !tableIds) return
    openRecordModal({
      tableId: tableIds.mediaTableId,
      recordId: null,
      supabaseTableName: tableIds.mediaSupabaseTable,
      interfaceMode,
      recordLayoutType: "asset",
      onSave: () => reload(),
      onRecordUpdated: () => reload(),
    })
  }, [canCreateResource, tableIds, openRecordModal, interfaceMode, reload])

  if (demoState.showEmptyState && !demoState.useDemoData) {
    return (
      <div
        data-block-selectable
        className={marketingBlockRootClass(
          isFullPage,
          "min-h-[200px] rounded-2xl border border-border/40 bg-background p-6"
        )}
      >
        <HubHeader
          title={title}
          subtitle={subtitle}
          showSearch={showSearch}
          searchQuery=""
          onSearchChange={() => {}}
          onCreate={canCreateResource ? handleCreateResource : undefined}
        />
        <DashboardEmpty title="No resources" description={demoState.bannerMessage} variant="default" />
      </div>
    )
  }

  if (loading && !demoState.useLiveData && !forceMock) {
    return (
      <div
        className={cn(
          marketingBlockRootClass(
            isFullPage,
            "min-h-[200px] rounded-xl border border-border/40 bg-background"
          ),
          "items-center justify-center"
        )}
      >
        <LoadingSpinner size="lg" text="Loading resources…" />
      </div>
    )
  }

  if (isListLayout) {
    return (
      <div
        data-block-selectable
        className={marketingBlockRootClass(
          isFullPage,
          "rounded-xl border border-[#E6E6EF] bg-white shadow-sm"
        )}
      >
        {isDemoData ? (
          <div className="shrink-0">
            <MarketingDemoDataBanner message={demoBannerMessage} />
          </div>
        ) : null}
        <ResourceListHeader
          title={title}
          subtitle={subtitle}
          onCreate={canCreateResource ? handleCreateResource : undefined}
        />
        <div
          className={cn(
            "min-h-0 flex-1 flex flex-col",
            marketingBlockScrollPanelClass(isFullPage)
          )}
        >
          <ResourceList
            resources={resources}
            onSelect={openResourceUrl}
            onAddResource={canCreateResource ? handleCreateResource : undefined}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      data-block-selectable
      className={marketingBlockRootClass(
        isFullPage,
        "rounded-card-lg border border-[#e4e7ec] bg-[#eceef1] shadow-card"
      )}
    >
      {isDemoData ? (
        <div className="shrink-0">
          <MarketingDemoDataBanner message={demoBannerMessage} />
        </div>
      ) : null}
      <FilterResultsAnnouncer count={filtered.length} noun="resources" />
      <HubHeader
        title={title}
        subtitle={subtitle}
        showSearch={showSearch}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onCreate={canCreateResource ? handleCreateResource : undefined}
        heroImageUrl={heroImageUrl}
      />

      {showFilters ? (
        <CategoryPills
          className="shrink-0"
          category={category}
          counts={counts}
          onCategoryChange={setCategory}
        />
      ) : null}

      <main
        className={cn(
          "min-h-0 flex-1 bg-[#eceef1]",
          marketingBlockScrollPanelClass(isFullPage) || "overflow-y-auto"
        )}
      >
        <ResourceGrid
          resources={gridResources}
          featured={featured}
          favourites={favourites}
          category={category}
          totalCount={filteredBase.length}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
          showFeatured={showFeaturedRow}
          onSelect={handleSelect}
          onToggleFavourite={toggleFavouriteById}
          onClearFilters={clearFilters}
          hasActiveFilters={filtersActive}
        />
      </main>

      {showSideDetailPanel && selected ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-[#0f1c2b]/40 md:left-64"
            onClick={handleBack}
            aria-label="Close resource details"
          />
          <DetailPanel
            resource={selected}
            variants={variants}
            selectedId={selectedId}
            isFavourite={selectedId ? favourites.has(selectedId) : false}
            isEditing={isEditing}
            onToggleFavourite={toggleFavourite}
            onSelectVariant={handleSelect}
            onClose={handleBack}
            onDownload={() => {
              if (isEditing) return
              if (selected?.url) window.open(selected.url, "_blank", "noopener,noreferrer")
            }}
            onViewFull={() => {
              if (isEditing) return
              openResourceUrl(selectedId!)
            }}
            onCopyLink={async () => {
              const url = selected?.url
              if (!url) return
              try {
                await navigator.clipboard.writeText(url)
              } catch {
                // Clipboard unavailable — no-op
              }
            }}
            onEditDetails={
              canManageSelectedResource && selectedId
                ? () => handleEditResourceDetails(selectedId)
                : undefined
            }
            className="fixed right-0 top-0 bottom-0 z-50 h-full max-h-screen w-full max-w-[392px] overflow-hidden"
          />
        </>
      ) : null}
    </div>
  )
}
