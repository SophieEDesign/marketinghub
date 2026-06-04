"use client"

import { Lock, Search, Filter, ShieldCheck, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface HubHeaderProps {
  title: string
  subtitle: string
  showSearch: boolean
  searchQuery: string
  onSearchChange: (q: string) => void
  onFilterClick?: () => void
  onCreate?: () => void
  className?: string
}

export default function HubHeader({
  title,
  subtitle,
  showSearch,
  searchQuery,
  onSearchChange,
  onFilterClick,
  onCreate,
  className,
}: HubHeaderProps) {
  return (
    <header
      className={cn(
        "shrink-0 border-b border-border/60 bg-background px-4 py-4 md:px-5",
        className
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
              <ShieldCheck className="h-3 w-3" />
              Internal Hub
            </span>
            <Lock className="h-3 w-3 text-muted-foreground/60" aria-hidden />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-[#1e3a5f] md:text-2xl">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2 lg:mt-1">
          {showSearch && (
            <>
              <div className="relative w-full min-w-[200px] sm:w-56">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search resources…"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="h-9 pl-9 text-sm border-border/60 bg-muted/20"
                />
              </div>
              {onFilterClick ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0 gap-1.5 border-border/60"
                  onClick={onFilterClick}
                >
                  <Filter className="h-4 w-4" />
                  <span className="hidden sm:inline">Filter</span>
                </Button>
              ) : null}
            </>
          )}
          {onCreate ? (
            <Button
              type="button"
              size="sm"
              className="h-9 shrink-0 gap-1.5"
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
