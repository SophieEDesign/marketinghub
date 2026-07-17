"use client"

import { useState } from "react"
import { ArrowDownAZ, Clock, Grid3X3, LayoutList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import FeaturedPinnedCard, { FeaturedPinnedSectionLabel } from "./FeaturedPinnedCard"
import ResourceCard from "./ResourceCard"
import ResourceListRow from "./ResourceListRow"
import { HUB_CATEGORY_OPTIONS, type CategoryFilter, type MockResource } from "./types"
import type { ResourceSortMode } from "./utils"

type LayoutView = "grid" | "list"

interface ResourceGridProps {
  resources: MockResource[]
  featured?: MockResource[]
  favourites: Set<string>
  category: CategoryFilter
  totalCount: number
  sortMode: ResourceSortMode
  onSortModeChange: (mode: ResourceSortMode) => void
  showFeatured?: boolean
  onSelect: (id: string) => void
  onToggleFavourite?: (id: string) => void
  onClearFilters?: () => void
  hasActiveFilters?: boolean
}

function categoryHeading(category: CategoryFilter): string {
  if (category === "all") return "All resources"
  if (category === "favourites") return "Favourites"
  const match = HUB_CATEGORY_OPTIONS.find((o) => o.id === category)
  return match?.label ?? "Resources"
}

export default function ResourceGrid({
  resources,
  featured = [],
  favourites,
  category,
  totalCount,
  sortMode,
  onSortModeChange,
  showFeatured = false,
  onSelect,
  onToggleFavourite,
  onClearFilters,
  hasActiveFilters = false,
}: ResourceGridProps) {
  const [layoutView, setLayoutView] = useState<LayoutView>("grid")
  const heading = categoryHeading(category)
  const isEmpty = resources.length === 0 && !(showFeatured && featured.length > 0)

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center md:px-8">
        <Grid3X3 className="h-10 w-10 text-[#9aa1ab]/50" />
        <p className="text-base font-semibold text-[#1f2a44]">No resources found</p>
        <p className="max-w-sm text-sm text-[#9aa1ab]">
          Try a different search or category, or add a new resource to the library.
        </p>
        {hasActiveFilters && onClearFilters ? (
          <Button
            type="button"
            className="mt-1 min-h-11 bg-[#005b8f] hover:bg-[#004a75]"
            onClick={onClearFilters}
          >
            Clear filters
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-6 px-4 py-6 md:px-8 md:pb-14">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[#1f2a44]">{heading}</h2>
          <p className="mt-1 text-[13px] text-[#9aa1ab]">
            {totalCount} resource{totalCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-[9px] border border-[#e2e6ea] bg-white p-0.5">
            <button
              type="button"
              onClick={() => onSortModeChange("recent")}
              className={cn(
                "inline-flex min-h-9 items-center rounded-md px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005b8f]",
                sortMode === "recent"
                  ? "bg-[#005b8f] text-white"
                  : "text-[#1f2a44]/80 hover:bg-[#eceef1]"
              )}
              aria-pressed={sortMode === "recent"}
            >
              <Clock className="mr-1.5 h-3.5 w-3.5" />
              Recent
            </button>
            <button
              type="button"
              onClick={() => onSortModeChange("az")}
              className={cn(
                "inline-flex min-h-9 items-center rounded-md px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005b8f]",
                sortMode === "az"
                  ? "bg-[#005b8f] text-white"
                  : "text-[#1f2a44]/80 hover:bg-[#eceef1]"
              )}
              aria-pressed={sortMode === "az"}
            >
              <ArrowDownAZ className="mr-1.5 h-3.5 w-3.5" />
              A–Z
            </button>
          </div>
          <div className="flex items-center gap-0.5 rounded-[9px] border border-[#e2e6ea] bg-white p-0.5">
            <button
              type="button"
              onClick={() => setLayoutView("grid")}
              className={cn(
                "flex h-8 w-9 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005b8f]",
                layoutView === "grid" ? "bg-[#005b8f] text-white" : "text-[#1f2a44]/70 hover:bg-[#eceef1]"
              )}
              aria-label="Grid view"
              aria-pressed={layoutView === "grid"}
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setLayoutView("list")}
              className={cn(
                "flex h-8 w-9 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005b8f]",
                layoutView === "list" ? "bg-[#005b8f] text-white" : "text-[#1f2a44]/70 hover:bg-[#eceef1]"
              )}
              aria-label="List view"
              aria-pressed={layoutView === "list"}
            >
              <LayoutList className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {showFeatured && featured.length > 0 ? (
        <section aria-label="Pinned essentials">
          <FeaturedPinnedSectionLabel />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {featured.map((r) => (
              <FeaturedPinnedCard
                key={`featured-${r.id}`}
                resource={r}
                isFavourite={favourites.has(r.id)}
                onSelect={onSelect}
                onToggleFavourite={onToggleFavourite}
              />
            ))}
          </div>
        </section>
      ) : null}

      {resources.length > 0 ? (
        <section aria-label={heading}>
          {showFeatured && featured.length > 0 ? (
            <p className="mb-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#9aa1ab]">
              {heading}
            </p>
          ) : null}

          {layoutView === "list" ? (
            <div className="overflow-hidden rounded-[14px] border border-[#e2e6ea] bg-white">
              {resources.map((r) => (
                <ResourceListRow
                  key={r.id}
                  resource={r}
                  isFavourite={favourites.has(r.id)}
                  onSelect={onSelect}
                  onToggleFavourite={onToggleFavourite}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {resources.map((r) => (
                <ResourceCard
                  key={r.id}
                  resource={r}
                  isFavourite={favourites.has(r.id)}
                  onSelect={onSelect}
                  onToggleFavourite={onToggleFavourite}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
