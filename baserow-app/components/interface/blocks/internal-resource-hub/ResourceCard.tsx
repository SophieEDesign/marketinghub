"use client"

import { HardDrive, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import PreviewByType from "./PreviewByType"
import {
  categoryLabel,
  getFileTypeBadgeClasses,
  type MockResource,
} from "./types"

interface ResourceCardProps {
  resource: MockResource
  isFavourite?: boolean
  onSelect: (id: string) => void
  onToggleFavourite?: (id: string) => void
}

export default function ResourceCard({
  resource,
  isFavourite,
  onSelect,
  onToggleFavourite,
}: ResourceCardProps) {
  const sourceLabel = resource.source

  return (
    <article className="group relative">
      <button
        type="button"
        onClick={() => onSelect(resource.id)}
        className="flex w-full flex-col overflow-hidden rounded-[14px] border border-[#e2e6ea] bg-white text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(31,42,68,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005b8f]"
      >
        <div className="relative aspect-[5/4] w-full overflow-hidden bg-[#eceef1]">
          <PreviewByType resource={resource} className="h-full w-full" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#1f2a44]/55 to-transparent" />
          <span
            className={cn(
              "absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase",
              getFileTypeBadgeClasses(resource.fileType)
            )}
          >
            {resource.fileType}
          </span>
          {sourceLabel ? (
            <span className="absolute bottom-2 left-2 inline-flex max-w-[calc(100%-3rem)] items-center gap-1 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-[#1f2a44] backdrop-blur-sm">
              <HardDrive className="h-3 w-3 shrink-0 text-[#005b8f]" aria-hidden />
              <span className="truncate">{sourceLabel}</span>
            </span>
          ) : null}
          <p className="absolute inset-x-3 bottom-2 truncate text-sm font-semibold text-white">
            {resource.title}
          </p>
        </div>
        <div className="space-y-0.5 px-3 pb-3 pt-2">
          <p className="truncate text-xs text-[#9aa1ab]">
            {resource.description ?? categoryLabel(resource.category)}
          </p>
          {resource.updatedAt || resource.addedAt ? (
            <p className="text-[10px] text-[#9aa1ab]/90">
              {resource.updatedAt ?? resource.addedAt}
            </p>
          ) : null}
        </div>
      </button>
      {onToggleFavourite ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavourite(resource.id)
          }}
          className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-[#9aa1ab] shadow-sm backdrop-blur-sm transition-colors hover:text-[#c4a574] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005b8f]"
          aria-label={isFavourite ? "Remove from favourites" : "Add to favourites"}
        >
          <Star
            className={cn(
              "h-4 w-4",
              isFavourite ? "fill-[#c4a574] text-[#c4a574]" : undefined
            )}
          />
        </button>
      ) : null}
    </article>
  )
}
