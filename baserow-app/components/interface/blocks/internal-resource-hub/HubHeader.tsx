"use client"

import { Plus, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface HubHeaderProps {
  title: string
  subtitle: string
  showSearch: boolean
  searchQuery: string
  onSearchChange: (q: string) => void
  onCreate?: () => void
  heroImageUrl?: string
  className?: string
}

export default function HubHeader({
  title,
  subtitle,
  showSearch,
  searchQuery,
  onSearchChange,
  onCreate,
  heroImageUrl,
  className,
}: HubHeaderProps) {
  return (
    <header className={cn("relative shrink-0 overflow-hidden", className)}>
      <div className="absolute inset-0 bg-[#1f2a44]">
        {heroImageUrl ? (
          <img src={heroImageUrl} alt="" className="h-full w-full object-cover object-[center_42%]" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#0f1c2b] via-[#1f2a44] to-[#005b8f]/80" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f1c2b]/88 via-[#0f1c2b]/58 to-[#0f1c2b]/28" />
      </div>

      <div className="relative mx-auto max-w-[1392px] px-5 py-7 md:px-9 md:py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#d9c49a]">
              Internal Staff Hub
            </p>
            <h2 className="text-2xl font-light tracking-tight text-white md:text-[32px] md:leading-tight">
              {title}
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-[#d3dbe6]">{subtitle}</p>
            {showSearch ? (
              <div className="mt-1 flex h-11 max-w-[430px] items-center gap-2.5 rounded-[11px] border border-white/25 bg-white/10 px-3.5 backdrop-blur-md">
                <Search className="h-4 w-4 shrink-0 text-white/80" aria-hidden />
                <input
                  type="search"
                  placeholder="Search the library…"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="h-full min-w-0 flex-1 border-none bg-transparent text-sm text-white outline-none placeholder:text-white/55"
                  aria-label="Search resources"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => onSearchChange("")}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/80 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          {onCreate ? (
            <Button
              type="button"
              size="sm"
              className="h-11 shrink-0 gap-1.5 bg-[#c4a574] px-4 text-[#1f2a44] hover:bg-[#b08d52]"
              onClick={onCreate}
            >
              <Plus className="h-4 w-4" />
              Create
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  )
}
