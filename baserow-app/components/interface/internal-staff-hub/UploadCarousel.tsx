"use client"

import { useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import AssetCard from "@/components/interface/internal-staff-hub/AssetCard"
import type { StaffHubAsset } from "@/lib/marketing/internal-staff-hub"
import { cn } from "@/lib/utils"

interface UploadCarouselProps {
  items: StaffHubAsset[]
  onPreview: (asset: StaffHubAsset) => void
  className?: string
}

export default function UploadCarousel({ items, onPreview, className }: UploadCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (dir: -1 | 1) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir * 280, behavior: "smooth" })
  }

  if (items.length === 0) return null

  return (
    <div className={cn("relative", className)}>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-thin -mx-0.5 px-0.5"
      >
        {items.map((item) => (
          <AssetCard
            key={item.id}
            asset={item}
            variant="carousel"
            onPreview={onPreview}
          />
        ))}
      </div>
      {items.length > 3 ? (
        <>
          <button
            type="button"
            onClick={() => scroll(-1)}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 hidden sm:flex h-8 w-8 items-center justify-center rounded-full bg-card border border-border/50 shadow-card text-muted-foreground hover:text-foreground"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 hidden sm:flex h-8 w-8 items-center justify-center rounded-full bg-card border border-border/50 shadow-card text-muted-foreground hover:text-foreground"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      ) : null}
    </div>
  )
}
