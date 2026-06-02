"use client"

import { Star } from "lucide-react"
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
}

export default function ResourceCard({
  resource,
  isFavourite,
  onSelect,
}: ResourceCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(resource.id)}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card text-left shadow-card transition-shadow duration-200 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="relative aspect-[5/4] w-full overflow-hidden bg-muted/20">
        <PreviewByType resource={resource} className="h-full w-full" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/45 to-transparent" />
        <span
          className={cn(
            "absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase",
            getFileTypeBadgeClasses(resource.fileType)
          )}
        >
          {resource.fileType}
        </span>
        {isFavourite && (
          <Star className="absolute right-2 top-2 h-4 w-4 fill-amber-400 text-amber-400" />
        )}
        <p className="absolute inset-x-3 bottom-2 truncate text-sm font-semibold text-white">
          {resource.title}
        </p>
      </div>
      <div className="space-y-0.5 px-3 pb-3 pt-2">
        <p className="truncate text-xs text-muted-foreground">
          {resource.description ?? categoryLabel(resource.category)}
        </p>
        {resource.addedAt && (
          <p className="text-[10px] text-muted-foreground/80">{resource.addedAt}</p>
        )}
      </div>
    </button>
  )
}
