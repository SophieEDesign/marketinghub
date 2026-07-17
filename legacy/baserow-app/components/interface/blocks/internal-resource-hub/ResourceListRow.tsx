"use client"

import { HardDrive, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import PreviewByType from "./PreviewByType"
import {
  categoryLabel,
  getFileTypeBadgeClasses,
  type MockResource,
} from "./types"

interface ResourceListRowProps {
  resource: MockResource
  isFavourite?: boolean
  onSelect: (id: string) => void
  onToggleFavourite?: (id: string) => void
}

export default function ResourceListRow({
  resource,
  isFavourite,
  onSelect,
  onToggleFavourite,
}: ResourceListRowProps) {
  return (
    <div className="flex items-center gap-3.5 border-b border-[#eef1f4] px-4 py-2.5 last:border-b-0 hover:bg-[#f7f9fb]">
      <button
        type="button"
        onClick={() => onSelect(resource.id)}
        className="flex min-w-0 flex-1 items-center gap-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005b8f] focus-visible:ring-offset-2"
      >
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-[9px] bg-[#eceef1]">
          <PreviewByType resource={resource} className="h-full w-full" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold text-[#1f2a44]">{resource.title}</p>
          <p className="mt-0.5 truncate text-[11.5px] text-[#9aa1ab]">
            {categoryLabel(resource.category)}
          </p>
        </div>
        {resource.source ? (
          <span className="hidden w-32 shrink-0 items-center gap-1.5 text-[11px] font-semibold text-[#5c6168] sm:inline-flex">
            <HardDrive className="h-3.5 w-3.5" aria-hidden />
            <span className="truncate">{resource.source}</span>
          </span>
        ) : null}
        <span className="hidden w-24 shrink-0 text-xs text-[#9aa1ab] md:block">
          {resource.updatedAt ?? resource.addedAt ?? "—"}
        </span>
        <span
          className={cn(
            "w-12 shrink-0 rounded px-1.5 py-0.5 text-center text-[9px] font-bold uppercase",
            getFileTypeBadgeClasses(resource.fileType)
          )}
        >
          {resource.fileType}
        </span>
      </button>
      {onToggleFavourite ? (
        <button
          type="button"
          onClick={() => onToggleFavourite(resource.id)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[#9aa1ab] hover:text-[#c4a574] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005b8f]"
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
    </div>
  )
}
