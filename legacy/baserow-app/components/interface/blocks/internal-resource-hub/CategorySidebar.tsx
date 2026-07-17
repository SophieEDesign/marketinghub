"use client"

import { ChevronRight, Folder, ShieldCheck, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  HUB_CATEGORY_OPTIONS,
  getFileTypeBadgeClasses,
  type CategoryFilter,
  type MockResource,
} from "./types"

interface CategorySidebarProps {
  category: CategoryFilter
  counts: Record<CategoryFilter, number>
  recent: MockResource[]
  noticeText: string
  showRecent: boolean
  onCategoryChange: (c: CategoryFilter) => void
  onSelectResource: (id: string) => void
  className?: string
}

function RailItem({
  active,
  label,
  count,
  icon: Icon,
  onClick,
}: {
  active: boolean
  label: string
  count: number
  icon: React.ElementType
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors",
        active
          ? "border-l-[3px] border-[#005b8f] bg-[#005b8f]/8 pl-[calc(0.625rem-3px)] font-semibold text-[#005b8f]"
          : "border-l-[3px] border-transparent text-[#1f2a44]/85 hover:bg-[#eceef1]"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-[#005b8f]" : "text-[#9aa1ab]")} />
      <span className="flex-1 truncate">{label}</span>
      <span
        className={cn(
          "text-[11px] font-semibold tabular-nums",
          active ? "text-[#005b8f]/80" : "text-[#9aa1ab]"
        )}
      >
        {count}
      </span>
    </button>
  )
}

export default function CategorySidebar({
  category,
  counts,
  recent,
  noticeText,
  showRecent,
  onCategoryChange,
  onSelectResource,
  className,
}: CategorySidebarProps) {
  const categoryOptions = HUB_CATEGORY_OPTIONS.filter((o) => o.id !== "all")

  return (
    <aside
      className={cn(
        "flex w-[244px] shrink-0 flex-col border-r border-[#e4e7ec] bg-white",
        className
      )}
    >
      <nav className="flex-1 overflow-y-auto px-3.5 py-5">
        <p className="mb-2.5 px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#9aa1ab]">
          Library
        </p>
        <div className="space-y-0.5">
          <RailItem
            active={category === "all"}
            label="All resources"
            count={counts.all ?? 0}
            icon={Folder}
            onClick={() => onCategoryChange("all")}
          />
          <RailItem
            active={category === "favourites"}
            label="Favourites"
            count={counts.favourites ?? 0}
            icon={Star}
            onClick={() => onCategoryChange("favourites")}
          />
        </div>

        <div className="mx-2.5 my-3 h-px bg-[#eef1f4]" />

        <p className="mb-2.5 px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#9aa1ab]">
          Categories
        </p>
        <div className="space-y-0.5">
          {categoryOptions.map((opt) => {
            const Icon = opt.icon
            return (
              <RailItem
                key={opt.id}
                active={category === opt.id}
                label={opt.label}
                count={counts[opt.id] ?? 0}
                icon={Icon}
                onClick={() => onCategoryChange(opt.id)}
              />
            )
          })}
        </div>
      </nav>

      {showRecent && recent.length > 0 && (
        <div className="border-t border-[#e4e7ec] px-3.5 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9aa1ab]">
              Recently added
            </span>
            <button
              type="button"
              className="text-xs text-[#005b8f] hover:underline"
              onClick={() => onCategoryChange("all")}
            >
              View all
            </button>
          </div>
          <ul className="space-y-2">
            {recent.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onSelectResource(r.id)}
                  className="group w-full text-left"
                >
                  <p className="truncate text-xs font-medium text-[#1f2a44] group-hover:text-[#005b8f]">
                    {r.title}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded px-1 py-0 text-[9px] font-semibold uppercase",
                        getFileTypeBadgeClasses(r.fileType)
                      )}
                    >
                      {r.fileType}
                    </span>
                    {r.addedAt ? (
                      <span className="text-[10px] text-[#9aa1ab]">{r.addedAt}</span>
                    ) : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="p-3.5">
        <div className="rounded-[10px] border border-[#ece3cf] bg-[#f7f4ec] p-3">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#b08d52]" />
            <p className="flex-1 text-xs leading-relaxed text-[#1f2a44]/80">{noticeText}</p>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#c4a574]" aria-hidden />
          </div>
        </div>
      </div>
    </aside>
  )
}
