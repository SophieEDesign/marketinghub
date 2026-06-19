"use client"

import { ArrowDownAZ, Clock, Grid3X3, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import ResourceCard from "./ResourceCard"
import type { MockResource } from "./types"
import type { ResourceSortMode } from "./utils"

interface ResourceGridProps {
  resources: MockResource[]
  featured?: MockResource[]
  favourites: Set<string>
  sortMode: ResourceSortMode
  onSortModeChange: (mode: ResourceSortMode) => void
  showFeatured?: boolean
  onSelect: (id: string) => void
  onToggleFavourite?: (id: string) => void
  onClearFilters?: () => void
  hasActiveFilters?: boolean
}

export default function ResourceGrid({
  resources,
  featured = [],
  favourites,
  sortMode,
  onSortModeChange,
  showFeatured = false,
  onSelect,
  onToggleFavourite,
  onClearFilters,
  hasActiveFilters = false,
}: ResourceGridProps) {
  if (resources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <Grid3X3 className="h-10 w-10 text-[#9aa1ab]/50" />
        <p className="text-sm font-medium text-[#1f2a44]/70">No resources found</p>
        <p className="text-xs text-[#9aa1ab]">Try a different category or search term.</p>
        {hasActiveFilters && onClearFilters ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-1 min-h-11 border-[#e4e7ec]"
            onClick={onClearFilters}
          >
            Clear filters
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-[#1f2a44]">
          {resources.length} resource{resources.length === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-1 rounded-lg border border-[#e4e7ec] bg-white p-0.5">
          <button
            type="button"
            onClick={() => onSortModeChange("recent")}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005b8f]",
              sortMode === "recent"
                ? "bg-[#005b8f] text-white"
                : "text-[#1f2a44]/80 hover:bg-[#eceef1]"
            )}
            aria-pressed={sortMode === "recent"}
          >
            <Clock className="h-3.5 w-3.5" />
            Recent
          </button>
          <button
            type="button"
            onClick={() => onSortModeChange("az")}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005b8f]",
              sortMode === "az"
                ? "bg-[#005b8f] text-white"
                : "text-[#1f2a44]/80 hover:bg-[#eceef1]"
            )}
            aria-pressed={sortMode === "az"}
          >
            <ArrowDownAZ className="h-3.5 w-3.5" />
            A–Z
          </button>
        </div>
      </div>

      {showFeatured && featured.length > 0 ? (
        <section aria-label="Pinned essentials">
          <div className="mb-3 flex items-center gap-2">
            <List className="h-4 w-4 text-[#c4a574]" />
            <h3 className="text-sm font-semibold text-[#1f2a44]">Pinned essentials</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {featured.map((r) => (
              <ResourceCard
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
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
    </div>
  )
}
