"use client"

/**
 * Internal Resource Hub — visual media library block for internal staff.
 *
 * TODO: connect resources to Supabase/storage/media table (see useInternalStaffHubData)
 * TODO: add permission checks for internal staff only (isAdmin / role gate)
 */

import { useCallback, useMemo, useState } from "react"
import type { PageBlock } from "@/lib/interface/types"
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

interface InternalResourceHubBlockProps {
  block: PageBlock
  isEditing?: boolean
  onUpdate?: (updates: Partial<PageBlock["config"]>) => void
}

function mockAction(label: string) {
  debugLog(`[InternalResourceHub] ${label}`)
}

export default function InternalResourceHubBlock({
  block,
  isEditing = false,
}: InternalResourceHubBlockProps) {
  const { config } = block
  const title = config.title || "Brand & Media Resources"
  const subtitle =
    config.resource_hub_subtitle ||
    "Access official logos, brand assets, images and documents for internal use."
  const showSearch = config.resource_hub_show_search !== false
  const showRecent = config.resource_hub_show_recent !== false
  const showUploadArea =
    config.resource_hub_show_upload !== false && isEditing
  const layoutMode = config.resource_hub_layout_mode || "gallery"
  const isListLayout = layoutMode === "list"
  const useDashboardMock = config.resource_hub_use_dashboard_mock === true

  const [category, setCategory] = useState<CategoryFilter>(() =>
    parseDefaultCategory(config.resource_hub_default_category)
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [favourites, setFavourites] = useState<Set<string>>(() => new Set())

  const resources = useDashboardMock ? MARKETING_HOME_MOCK_RESOURCES : MOCK_RESOURCES
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

  if (isListLayout) {
    return (
      <div className="flex h-full min-h-[320px] w-full min-w-0 flex-col overflow-hidden rounded-xl border border-[#E6E6EF] bg-white shadow-sm">
        <ResourceListHeader
          title={title}
          subtitle={subtitle}
          onViewAll={() => mockAction("View all resources")}
        />
        <ResourceList
          resources={resources}
          onSelect={(id) => mockAction(`Open resource: ${id}`)}
          onAddResource={() => mockAction("Add resource")}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-[400px] w-full min-w-0 flex-col overflow-hidden rounded-card-lg border border-border/60 bg-background shadow-card">
      <HubHeader
        title={title}
        subtitle={subtitle}
        showSearch={showSearch}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onFilterClick={() => mockAction("Filter (stub)")}
      />

      <CategoryPills
        category={category}
        counts={counts}
        onCategoryChange={setCategory}
      />

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <CategorySidebar
          className="hidden md:flex"
          category={category}
          counts={counts}
          recent={recent}
          noticeText={noticeText}
          showRecent={showRecent}
          onCategoryChange={setCategory}
          onSelectResource={handleSelect}
        />

        <main className="min-h-0 flex-1 overflow-y-auto bg-muted/5">
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

        <DetailPanel
          resource={showPreview ? selected : null}
          isFavourite={selectedId ? favourites.has(selectedId) : false}
          isEditing={isEditing}
          onToggleFavourite={toggleFavourite}
          onDownload={() => mockAction(`Download: ${selected?.title}`)}
          onViewFull={() => mockAction(`View full: ${selected?.title}`)}
          onCopyLink={() => mockAction(`Copy link: ${selected?.title}`)}
          className={showPreview ? undefined : "hidden md:flex"}
        />
      </div>
    </div>
  )
}
