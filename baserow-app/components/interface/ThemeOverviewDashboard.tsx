"use client"

import { Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import AccentCard from "@/components/interface/primitives/AccentCard"
import DashboardEmpty from "@/components/interface/primitives/DashboardEmpty"
import DashboardPanel from "@/components/interface/primitives/DashboardPanel"
import { useRecordModal } from "@/contexts/RecordModalContext"
import { useThemeOverviewData } from "@/hooks/useThemeOverviewData"
import { quarterLabel, type ThemeOverviewCard } from "@/lib/marketing/theme-overview"
import { DASHBOARD_PAGE_GAP } from "@/lib/interface/spacing-tokens"
import { TEXT_CARD_TITLE, TEXT_LABEL, TEXT_PAGE_TITLE } from "@/lib/interface/typography-tokens"
import { cn } from "@/lib/utils"

const PROMPT_PREVIEW_COUNT = 3

interface ThemeOverviewDashboardProps {
  canEdit?: boolean
}

function ThemeCardHeader({ card }: { card: ThemeOverviewCard }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <h3 className={cn(TEXT_CARD_TITLE, "pr-2")}>{card.name}</h3>
      <div className="flex flex-wrap items-center gap-1 shrink-0">
        {card.quarterLabel ? (
          <Badge
            variant="outline"
            className="h-5 px-1.5 text-[10px] font-medium border-border/60"
          >
            {card.quarterLabel}
          </Badge>
        ) : null}
        {card.isCurrentQuarter ? (
          <Badge
            variant="outline"
            className="h-5 px-1.5 text-[10px] font-medium border-accent-link/25 bg-accent-link/10 text-accent-link"
          >
            Active
          </Badge>
        ) : null}
      </div>
    </div>
  )
}

function ThemeCard({
  card,
  isSecondary,
  canEdit,
  onOpenTheme,
  onOpenPrompt,
  onAddPrompt,
}: {
  card: ThemeOverviewCard
  isSecondary?: boolean
  canEdit?: boolean
  onOpenTheme: (id: string) => void
  onOpenPrompt: (id: string) => void
  onAddPrompt: (themeId: string) => void
}) {
  const visiblePrompts = card.prompts.slice(0, PROMPT_PREVIEW_COUNT)
  const moreCount = card.prompts.length - visiblePrompts.length

  return (
    <AccentCard
      accentColor={card.accentColor}
      accentPosition="left"
      density="compact"
      className={cn(
        "flex flex-col h-full p-0 overflow-hidden",
        isSecondary && "opacity-[0.94]",
        card.isCurrentQuarter && !isSecondary && "ring-1 ring-accent-link/20 shadow-card-hover"
      )}
    >
      <button
        type="button"
        onClick={() => onOpenTheme(card.id)}
        className="flex flex-col gap-2 p-3 text-left hover:bg-muted/25 transition-colors w-full rounded-t-card"
      >
        <ThemeCardHeader card={card} />
        {card.coreTitle && card.coreTitle !== card.name ? (
          <div>
            <p className={TEXT_LABEL}>Core focus</p>
            <p className="text-sm font-medium text-foreground leading-snug whitespace-pre-wrap mt-0.5">
              {card.coreTitle}
            </p>
          </div>
        ) : null}
        {card.description ? (
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {card.description}
          </p>
        ) : null}
      </button>

      <div className="border-t border-border/40 px-3 py-2.5 mt-auto min-h-[4.5rem]">
        <p className={cn(TEXT_LABEL, "mb-1.5")}>Content prompts</p>
        {card.prompts.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {visiblePrompts.map((prompt) => (
              <li key={prompt.id}>
                <button
                  type="button"
                  onClick={() => onOpenPrompt(prompt.id)}
                  className="w-full text-left text-sm text-foreground/90 rounded-inner px-2 py-1 bg-muted/35 hover:bg-muted/55 transition-colors"
                >
                  <span className="inline-block w-1 h-1 rounded-full mr-2 align-middle bg-foreground/35" />
                  {prompt.label}
                </button>
              </li>
            ))}
            {moreCount > 0 ? (
              <li>
                <button
                  type="button"
                  onClick={() => onOpenTheme(card.id)}
                  className="text-xs text-accent-link hover:underline px-2 py-0.5"
                >
                  +{moreCount} more
                </button>
              </li>
            ) : null}
          </ul>
        ) : (
          <DashboardEmpty title="No prompts yet" variant="inline" />
        )}
        {canEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1.5 h-7 px-2 text-xs text-accent-link hover:text-accent-link"
            onClick={() => onAddPrompt(card.id)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add prompt
          </Button>
        ) : null}
      </div>
    </AccentCard>
  )
}

function ActiveThemeHero({
  card,
  year,
  currentQuarter,
  onOpenTheme,
}: {
  card: ThemeOverviewCard
  year: number
  currentQuarter: number
  onOpenTheme: (id: string) => void
}) {
  return (
    <AccentCard
      elevated
      tintWash
      interactive
      accentColor={card.accentColor}
      accentPosition="top"
      density="comfortable"
      className="w-full text-left"
      onClick={() => onOpenTheme(card.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpenTheme(card.id)
        }
      }}
    >
      <ThemeCardHeader card={card} />
      <p className="text-meta mt-1.5">
        Current quarter · {quarterLabel(currentQuarter as 1 | 2 | 3 | 4)} {year}
      </p>
      {card.coreTitle && card.coreTitle !== card.name ? (
        <div className="mt-2.5">
          <p className={TEXT_LABEL}>Core focus</p>
          <p className="text-base font-semibold text-foreground leading-snug whitespace-pre-wrap mt-0.5">
            {card.coreTitle}
          </p>
        </div>
      ) : null}
      {card.description ? (
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {card.description}
        </p>
      ) : null}
    </AccentCard>
  )
}

export default function ThemeOverviewDashboard({ canEdit = false }: ThemeOverviewDashboardProps) {
  const { openRecordModal } = useRecordModal()
  const {
    loading,
    error,
    tableIds,
    fields,
    cards,
    activeCard,
    availableYears,
    selectedYear,
    setSelectedYear,
    currentQuarter,
    reload,
  } = useThemeOverviewData()

  const openTheme = (recordId: string) => {
    if (!tableIds) return
    openRecordModal({
      tableId: tableIds.quarterlyThemesTableId,
      recordId,
      supabaseTableName: tableIds.quarterlyThemesSupabaseTable,
      onRecordUpdated: reload,
      onDeleted: reload,
    })
  }

  const openPrompt = (recordId: string) => {
    if (!tableIds) return
    openRecordModal({
      tableId: tableIds.contentTableId,
      recordId,
      supabaseTableName: tableIds.contentSupabaseTable,
      onRecordUpdated: reload,
      onDeleted: reload,
    })
  }

  const addPrompt = (themeId: string) => {
    if (!tableIds || !fields?.contentTheme) return
    openRecordModal({
      tableId: tableIds.contentTableId,
      recordId: null,
      supabaseTableName: tableIds.contentSupabaseTable,
      initialData: { [fields.contentTheme]: themeId },
      onSave: () => reload(),
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" text="Loading themes…" />
      </div>
    )
  }

  if (error) {
    return (
      <DashboardPanel className="border-destructive/30 bg-destructive/5">
        <p className="p-3 text-sm text-destructive">{error}</p>
      </DashboardPanel>
    )
  }

  return (
    <div className={cn("flex flex-col min-w-0", DASHBOARD_PAGE_GAP)}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={TEXT_PAGE_TITLE}>Theme overview</h1>
          <p className="text-meta mt-0.5">
            Quarterly themes, core focus, and content prompts for the year
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[120px] h-8 text-sm" aria-label="Planning year">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary" className="h-8 px-2.5 text-xs font-medium rounded-inner">
            {quarterLabel(currentQuarter)} · Current quarter
          </Badge>
        </div>
      </header>

      {activeCard ? (
        <ActiveThemeHero
          card={activeCard}
          year={selectedYear}
          currentQuarter={currentQuarter}
          onOpenTheme={openTheme}
        />
      ) : (
        <DashboardEmpty
          variant="compact"
          title={`No theme is set for ${quarterLabel(currentQuarter)} ${selectedYear}.`}
          description="Add or link a quarterly theme for this period."
        />
      )}

      <section>
        <h2 className="text-section-title mb-2.5">Annual themes · {selectedYear}</h2>
        {cards.length === 0 ? (
          <DashboardEmpty
            variant="compact"
            title={`No themes found for ${selectedYear}.`}
            description="Create quarterly themes in your Themes table."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-x-4 gap-y-3 items-stretch">
            {cards.map((card) => (
              <ThemeCard
                key={card.id}
                card={card}
                isSecondary={!card.isCurrentQuarter}
                canEdit={canEdit}
                onOpenTheme={openTheme}
                onOpenPrompt={openPrompt}
                onAddPrompt={addPrompt}
              />
            ))}
          </div>
        )}
      </section>

      {!fields?.contentTheme ? (
        <p className="text-xs text-muted-foreground/75">
          Content prompts need a link field from Content to Quarterly Themes (e.g. quarterly_theme).
        </p>
      ) : null}
    </div>
  )
}
