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

  const metaLabel = resource.description ?? categoryLabel(resource.category)
  const timeLabel = resource.updatedAt ?? resource.addedAt

  return (
    <article className="group relative">
      <button
        type="button"
        onClick={() => onSelect(resource.id)}
        className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[#e2e6ea] bg-white text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(31,42,68,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005b8f]"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#eceef1] p-4">
          <PreviewByType resource={resource} className="h-full w-full" />
          <span
            className={cn(
              "absolute left-3 top-3 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
              getFileTypeBadgeClasses(resource.fileType)
            )}
          >
            {resource.fileType}
          </span>
        </div>
        <div className="flex min-h-[5.5rem] flex-col justify-between gap-2 px-4 py-3.5">
          <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-[#1f2a44]">
            {resource.title}
          </p>
          <div className="flex items-center justify-between gap-3 text-xs text-[#9aa1ab]">
            <p className="min-w-0 truncate">
              {metaLabel}
              {timeLabel ? ` · ${timeLabel}` : ""}
            </p>
            {sourceLabel ? (
              <span className="inline-flex shrink-0 items-center gap-1 font-medium text-[#1f2a44]/70">
                <HardDrive className="h-3.5 w-3.5 text-[#005b8f]" aria-hidden />
                <span className="max-w-[5.5rem] truncate">{sourceLabel}</span>
              </span>
            ) : null}
          </div>
        </div>
      </button>
      {onToggleFavourite ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavourite(resource.id)
          }}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#e2e6ea]/80 bg-white/95 text-[#9aa1ab] shadow-sm backdrop-blur-sm transition-colors hover:text-[#c4a574] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005b8f]"
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
