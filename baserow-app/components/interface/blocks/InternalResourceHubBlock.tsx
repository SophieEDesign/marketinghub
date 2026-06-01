"use client"

/**
 * Internal Resource Hub — visual media library block for internal staff.
 *
 * TODO: connect resources to Supabase/storage/media table (see useInternalStaffHubData)
 * TODO: add permission checks for internal staff only (isAdmin / role gate)
 */

import { useCallback, useMemo, useState } from "react"
import type { PageBlock } from "@/lib/interface/types"
import { useResourceHubData } from "@/hooks/useResourceHubData"
import {
  isMarketingMockEnabled,
  marketingDemoState,
  MARKETING_DEMO_BANNER_DEFAULT,
} from "@/lib/marketing/block-config-resolver"
import DashboardEmpty from "@/components/interface/primitives/DashboardEmpty"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import HubHeader from "./internal-resource-hub/HubHeader"
import CategorySidebar from "./internal-resource-hub/CategorySidebar"
import CategoryPills from "./internal-resource-hub/CategoryPills"
import ResourceGrid from "./internal-resource-hub/ResourceGrid"
import AssetPreviewView from "./internal-resource-hub/AssetPreviewView"
import DetailPanel from "./internal-resource-hub/DetailPanel"
import {
  MARKETING_HOME_MOCK_RESOURCES,
  MOCK_RESOURCES,
} from "./internal-resource-hub/mock-data"
import ResourceList, { ResourceListHeader } from "./internal-resource-hub/ResourceList"
import {
  countByCategory,
  filterResources,
  getRecent,
  getVariants,
  parseDefaultCategory,
} from "./internal-resource-hub/utils"
import type { CategoryFilter } from "./internal-resource-hub/types"
import { debugLog } from "@/lib/debug"
import MarketingDemoDataBanner from "@/components/interface/primitives/MarketingDemoDataBanner"
import {
  marketingBlockRootClass,
  marketingBlockScrollPanelClass,
} from "@/lib/interface/marketing-block-layout"
import { cn } from "@/lib/utils"

interface InternalResourceHubBlockProps {
  block: PageBlock
  isEditing?: boolean
  onUpdate?: (updates: Partial<PageBlock["config"]>) => void
  isFullPage?: boolean
}

function mockAction(label: string) {
  debugLog(`[InternalResourceHub] ${label}`)
}

export default function InternalResourceHubBlock({
  block,
  isEditing = false,
  isFullPage = false,
}: InternalResourceHubBlockProps) {
  const { config } = block
  const title = config.title || "Brand & Media Resources"
  const subtitle =
    config.resource_hub_subtitle ||
    "Access official logos, brand assets, images and documents for internal use."
  const showSearch = config.resource_hub_show_search !== false
  const showFilters = config.resource_hub_show_filters !== false
  const showRecent = config.resource_hub_show_recent !== false
  const showUploadArea =
    config.resource_hub_show_upload !== false && isEditing
  const layoutMode = config.resource_hub_layout_mode || "gallery"
  const isListLayout = layoutMode === "list"
  const forceMock = isMarketingMockEnabled(
    config,
    "resource_hub_use_mock",
    "resource_hub_use_dashboard_mock"
  )
  const maxItems =
    typeof config.resource_hub_max_items === "number" ? config.resource_hub_max_items : undefined
  const showDetailPanel = config.resource_hub_show_detail_panel !== false
  const { loading, error, fromLiveData, hasTable, resources: liveResources } =
    useResourceHubData({ config })

  const [category, setCategory] = useState<CategoryFilter>(() =>
    parseDefaultCategory(config.resource_hub_default_category)
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [favourites, setFavourites] = useState<Set<string>>(() => new Set())

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
  const counts = useMemo(() => countByCategory(resources), [resources])
  const filtered = useMemo(
    () => filterResources(resources, category, searchQuery),
    [resources, category, searchQuery]
  )
  const recent = useMemo(() => getRecent(resources), [resources])
  const selected = useMemo(
    () => resources.find((r) => r.id === selectedId) ?? null,
    [resources, selectedId]
  )
  const variants = useMemo(
    () => (selected ? getVariants(resources, selected) : []),
    [resources, selected]
  )

  const showPreview = selectedId !== null && selected !== null

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
  }, [])

  const handleBack = useCallback(() => {
    setSelectedId(null)
  }, [])

  const toggleFavourite = useCallback(() => {
    if (!selectedId) return
    setFavourites((prev) => {
      const next = new Set(prev)
      if (next.has(selectedId)) next.delete(selectedId)
      else next.add(selectedId)
      return next
    })
  }, [selectedId])

  const noticeText =
    config.resource_hub_internal_notice ||
    "For internal use only. Please follow brand guidelines in all communications."

  const openResourceUrl = useCallback(
    (id: string) => {
      const r = resources.find((x) => x.id === id)
      if (r?.url) window.open(r.url, "_blank", "noopener,noreferrer")
      else mockAction(`Open resource: ${id}`)
    },
    [resources]
  )

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
          onViewAll={() => mockAction("View all resources")}
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
            onAddResource={() => mockAction("Add resource")}
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
        "rounded-card-lg border border-border/60 bg-background shadow-card"
      )}
    >
      {isDemoData ? (
        <div className="shrink-0">
          <MarketingDemoDataBanner message={demoBannerMessage} />
        </div>
      ) : null}
      <HubHeader
        title={title}
        subtitle={subtitle}
        showSearch={showSearch}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onFilterClick={() => mockAction("Filter (stub)")}
      />

      {showFilters ? (
        <CategoryPills
          className="shrink-0"
          category={category}
          counts={counts}
          onCategoryChange={setCategory}
        />
      ) : null}

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col md:flex-row md:min-h-0",
          isFullPage && "h-full"
        )}
      >
        {showFilters ? (
          <CategorySidebar
            className={cn("hidden md:flex", isFullPage && "h-full min-h-0")}
            category={category}
            counts={counts}
            recent={recent}
            noticeText={noticeText}
            showRecent={showRecent}
            onCategoryChange={setCategory}
            onSelectResource={handleSelect}
          />
        ) : null}

        <main
          className={cn(
            "min-h-0 flex-1 bg-muted/5",
            marketingBlockScrollPanelClass(isFullPage) || "overflow-y-auto"
          )}
        >
          {showPreview && selected ? (
            <AssetPreviewView
              resource={selected}
              variants={variants}
              selectedId={selectedId!}
              showUpload={showUploadArea}
              isEditing={isEditing}
              onBack={handleBack}
              onSelectVariant={handleSelect}
            />
          ) : (
            <ResourceGrid
              resources={filtered}
              favourites={favourites}
              onSelect={handleSelect}
            />
          )}
        </main>

        {showDetailPanel ? (
          <DetailPanel
            resource={showPreview ? selected : null}
            isFavourite={selectedId ? favourites.has(selectedId) : false}
            isEditing={isEditing}
            onToggleFavourite={toggleFavourite}
            onDownload={() => {
              if (selected?.url) window.open(selected.url, "_blank", "noopener,noreferrer")
              else mockAction(`Download: ${selected?.title}`)
            }}
            onViewFull={() => openResourceUrl(selectedId!)}
            onCopyLink={() => mockAction(`Copy link: ${selected?.title}`)}
            className={cn(
              showPreview ? undefined : "hidden md:flex",
              isFullPage && "md:h-full md:min-h-0 md:overflow-y-auto"
            )}
          />
        ) : null}
      </div>
    </div>
  )
}
