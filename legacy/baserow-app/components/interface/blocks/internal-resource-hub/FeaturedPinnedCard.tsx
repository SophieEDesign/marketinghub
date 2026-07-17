"use client"

import { HardDrive, Sparkles, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import PreviewByType from "./PreviewByType"
import {
  categoryLabel,
  getFileTypeBadgeClasses,
  type MockResource,
} from "./types"

interface FeaturedPinnedCardProps {
  resource: MockResource
  isFavourite?: boolean
  onSelect: (id: string) => void
  onToggleFavourite?: (id: string) => void
}

export default function FeaturedPinnedCard({
  resource,
  isFavourite,
  onSelect,
  onToggleFavourite,
}: FeaturedPinnedCardProps) {
  const meta = [categoryLabel(resource.category), resource.fileSize].filter(Boolean).join(" · ")

  return (
    <article className="group relative">
      <button
        type="button"
        onClick={() => onSelect(resource.id)}
        className="flex w-full items-center gap-3.5 rounded-[14px] border border-[#ece3cf] bg-white p-3.5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(31,42,68,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005b8f] sm:gap-4 sm:p-4"
      >
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[11px] bg-[#eceef1] sm:h-[4.5rem] sm:w-[4.5rem]">
          <PreviewByType resource={resource} className="h-full w-full" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#1f2a44] sm:text-[15px]">{resource.title}</p>
          {meta ? <p className="mt-1 truncate text-xs text-[#9aa1ab]">{meta}</p> : null}
          {resource.source ? (
            <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#5c6168]">
              <HardDrive className="h-3.5 w-3.5 text-[#005b8f]" aria-hidden />
              {resource.source}
            </span>
          ) : null}
        </div>
      </button>
      <span className="pointer-events-none absolute right-3 top-3 text-[9px] font-bold uppercase tracking-[0.08em] text-[#b08d52]">
        Pinned
      </span>
      {onToggleFavourite ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavourite(resource.id)
          }}
          className="absolute right-3 bottom-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#e2e6ea]/80 bg-white/95 text-[#9aa1ab] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005b8f] sm:bottom-auto sm:top-3"
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

export function FeaturedPinnedSectionLabel() {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Sparkles className="h-4 w-4 text-[#b08d52]" aria-hidden />
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8b5e3b]">
        Pinned essentials
      </span>
    </div>
  )
}
