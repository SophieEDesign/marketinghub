"use client"

import type { ReactNode } from "react"
import type { PageBlock } from "@/lib/interface/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Lightbulb,
  Calendar,
  Filter,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  Target,
  ShieldCheck,
  ClipboardList,
  AlertTriangle,
  Info,
  ChevronDown,
  type LucideIcon,
} from "lucide-react"
import {
  MOCK_CONTENT_THEMES,
  type ContentThemeItem,
  type ContentThemeStatus,
} from "@/lib/interface/content-theme-mock-data"

interface ContentThemeBlockProps {
  block: PageBlock
  isEditing?: boolean
}

type AccentKey = ContentThemeItem["accent"]

const ACCENT_STYLES: Record<
  AccentKey,
  {
    iconWrap: string
    icon: string
    badge: string
    ideasBox: string
    emptyText: string
    activeBorder: string
    activeBg: string
  }
> = {
  blue: {
    iconWrap: "bg-blue-50",
    icon: "text-blue-600",
    badge: "bg-blue-100 text-blue-700",
    ideasBox: "bg-blue-50/70 border-blue-100",
    emptyText: "text-blue-600/70",
    activeBorder: "border-blue-300",
    activeBg: "bg-blue-50/30",
  },
  purple: {
    iconWrap: "bg-[#F3F0FF]",
    icon: "text-[#6D4AFF]",
    badge: "bg-[#F3F0FF] text-[#6D4AFF]",
    ideasBox: "bg-[#F3F0FF]/80 border-[#E6E6EF]",
    emptyText: "text-[#6D4AFF]/70",
    activeBorder: "border-[#6D4AFF]/40",
    activeBg: "bg-[#F3F0FF]/50",
  },
  green: {
    iconWrap: "bg-emerald-50",
    icon: "text-emerald-600",
    badge: "bg-emerald-100 text-emerald-700",
    ideasBox: "bg-emerald-50/70 border-emerald-100",
    emptyText: "text-emerald-600/70",
    activeBorder: "border-emerald-300",
    activeBg: "bg-emerald-50/30",
  },
  red: {
    iconWrap: "bg-rose-50",
    icon: "text-rose-600",
    badge: "bg-rose-100 text-rose-700",
    ideasBox: "bg-rose-50/70 border-rose-100",
    emptyText: "text-rose-600/70",
    activeBorder: "border-rose-300",
    activeBg: "bg-rose-50/30",
  },
}

const THEME_ICONS: Record<AccentKey, LucideIcon> = {
  blue: ClipboardList,
  purple: Target,
  green: ShieldCheck,
  red: AlertTriangle,
}

const STATUS_BADGE: Record<ContentThemeStatus, string> = {
  Previous: "bg-gray-100 text-gray-600",
  Active: "bg-[#F3F0FF] text-[#6D4AFF]",
  Upcoming: "bg-gray-50 text-gray-500 border border-[#E6E6EF]",
}

function HeaderButton({
  children,
  className,
  disabled,
}: {
  children: ReactNode
  className?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-[#E6E6EF] bg-white px-2.5 py-1.5 text-xs font-medium text-[#111827] shadow-sm transition-colors hover:bg-[#F8F8FC] disabled:opacity-60",
        className
      )}
    >
      {children}
    </button>
  )
}

export default function ContentThemeBlock({ block, isEditing = false }: ContentThemeBlockProps) {
  const { config } = block

  const blockTitle = config.title || "Content Themes"
  const subtitle =
    config.content_theme_subtitle ||
    "Strategic themes and content focus areas for the quarter."
  const year = config.content_theme_year ?? 2026
  const selectedQuarter = config.content_theme_quarter || "Q2"
  const showFilters = config.content_theme_show_filters !== false
  const showViewToggle = config.content_theme_show_view_toggle !== false
  const showFooter = config.content_theme_show_footer !== false
  const cardDensity = config.content_theme_card_density || "comfortable"
  const highlightCurrent = config.content_theme_highlight_current_quarter !== false
  const maxThemes = config.content_theme_max_themes ?? 4
  const viewMode = config.content_theme_view_mode || "grid"

  const quarterBadge = `${selectedQuarter} ${year}`

  // TODO: Connect themes to Quarterly Themes table
  // TODO: Connect content ideas to Content table
  // TODO: Connect campaigns to Campaigns table
  // TODO: Add Supabase data loading
  // TODO: Add filtering by year, quarter, division, status and owner
  const themes = MOCK_CONTENT_THEMES.slice(0, Math.max(1, maxThemes))

  const isCompact = cardDensity === "compact"
  const cardPadding = isCompact ? "p-3" : "p-4"
  const gridClass =
    viewMode === "list"
      ? "flex flex-col gap-3"
      : viewMode === "compact"
        ? "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
        : "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"

  const isThemeActive = (theme: ContentThemeItem) => {
    if (theme.status === "Active") return true
    if (highlightCurrent && theme.quarter === selectedQuarter) return true
    return false
  }

  return (
    <div
      data-block-selectable
      className={cn(
        "h-full min-h-0 overflow-auto rounded-xl border border-[#E6E6EF] bg-white shadow-sm",
        isEditing && "pointer-events-auto"
      )}
    >
      <div className="flex min-h-full flex-col">
        {/* Header */}
        <div
          className={cn(
            "flex flex-wrap items-start justify-between gap-3 border-b border-[#E6E6EF] bg-[#F8F8FC]/50",
            isCompact ? "px-4 py-3" : "px-5 py-4"
          )}
        >
          <div className="flex min-w-0 flex-1 gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F3F0FF]">
              <Lightbulb className="h-5 w-5 text-[#6D4AFF]" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-[#111827]">{blockTitle}</h2>
                <span className="rounded-md bg-[#F3F0FF] px-2 py-0.5 text-xs font-medium text-[#6D4AFF]">
                  {quarterBadge}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-[#6B7280]">{subtitle}</p>
            </div>
          </div>
          {(showFilters || showViewToggle) && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {showFilters && (
                <HeaderButton disabled={isEditing}>
                  <Filter className="h-3.5 w-3.5 text-[#6B7280]" />
                  Filter
                  <ChevronDown className="h-3 w-3 text-[#6B7280]" />
                </HeaderButton>
              )}
              {showViewToggle && (
                <HeaderButton disabled={isEditing}>
                  <LayoutGrid className="h-3.5 w-3.5 text-[#6B7280]" />
                  View
                  <ChevronDown className="h-3 w-3 text-[#6B7280]" />
                </HeaderButton>
              )}
              <HeaderButton className="px-2" disabled={isEditing} aria-label="More options">
                <MoreHorizontal className="h-4 w-4 text-[#6B7280]" />
              </HeaderButton>
            </div>
          )}
        </div>

        {/* Theme cards */}
        <div className={cn(isCompact ? "p-3" : "p-4", "flex-1")}>
          <div className={gridClass}>
            {themes.map((theme) => {
              const styles = ACCENT_STYLES[theme.accent]
              const Icon = THEME_ICONS[theme.accent]
              const active = isThemeActive(theme)
              const hasIdeas = theme.ideas.length > 0

              return (
                <article
                  key={theme.id}
                  className={cn(
                    "flex flex-col rounded-xl border bg-white transition-shadow",
                    cardPadding,
                    active
                      ? cn("border-[#6D4AFF]/35 shadow-sm", styles.activeBg)
                      : "border-[#E6E6EF] hover:border-[#E6E6EF]/80"
                  )}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                          styles.iconWrap
                        )}
                      >
                        <Icon className={cn("h-4 w-4", styles.icon)} aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold leading-snug text-[#111827]">
                          {theme.title}
                        </h3>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          styles.badge
                        )}
                      >
                        {theme.quarter}
                      </span>
                      {theme.status === "Active" && (
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-medium",
                            STATUS_BADGE.Active
                          )}
                        >
                          Active
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mb-3 flex items-center gap-1.5 text-xs text-[#6B7280]">
                    <Calendar className="h-3 w-3 shrink-0" aria-hidden />
                    <span>
                      {theme.themeType} · {theme.quarter} {year}
                    </span>
                  </div>

                  {theme.description ? (
                    <p className="mb-3 text-xs text-[#6B7280]">{theme.description}</p>
                  ) : null}

                  <div className="mb-1.5 text-xs font-medium text-[#111827]">Content ideas</div>
                  <div
                    className={cn(
                      "mb-3 flex-1 rounded-lg border px-3 py-2.5 text-xs",
                      styles.ideasBox
                    )}
                  >
                    {hasIdeas ? (
                      <ul className="space-y-2">
                        {theme.ideas.map((idea) => (
                          <li
                            key={idea.id}
                            className="flex gap-2 leading-snug text-[#111827]"
                          >
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current opacity-40" />
                            <span>{idea.title}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className={cn("italic", styles.emptyText)}>No ideas yet</p>
                    )}
                  </div>

                  {/* TODO: Add "Add idea" action to open/create linked Content record */}
                  <button
                    type="button"
                    disabled={isEditing}
                    onClick={() => {
                      /* placeholder until RecordModal wiring */
                    }}
                    className={cn(
                      "flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-[#E6E6EF] py-2 text-xs font-medium text-[#6B7280] transition-colors hover:border-[#6D4AFF]/30 hover:bg-[#F8F8FC] hover:text-[#6D4AFF] disabled:opacity-60",
                      isCompact && "py-1.5"
                    )}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add idea
                  </button>
                </article>
              )
            })}
          </div>
        </div>

        {/* Footer strip */}
        {showFooter && (
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 border-t border-[#E6E6EF] bg-[#F3F0FF] px-4 py-3",
              isCompact && "px-3 py-2.5"
            )}
          >
            <div className="flex min-w-0 items-start gap-2 text-sm text-[#6B7280]">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#6D4AFF]" aria-hidden />
              <p>
                These themes guide our content strategy and help us stay focused on what matters
                most.
              </p>
            </div>
            {/* TODO: Add "Add theme" action to create Quarterly Theme record */}
            {/* TODO: Add RecordModal / RecordEditor support for theme editing */}
            {/* TODO: Add permissions */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isEditing}
              className="shrink-0 border-[#6D4AFF]/30 bg-white text-[#6D4AFF] hover:bg-white hover:text-[#6D4AFF]"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add theme
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
