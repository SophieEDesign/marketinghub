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
import { useRecordModal } from "@/contexts/RecordModalContext"
import { useThemeOverviewData } from "@/hooks/useThemeOverviewData"
import { quarterLabel, type ThemeOverviewCard } from "@/lib/marketing/theme-overview"
import { cn } from "@/lib/utils"

interface ThemeOverviewDashboardProps {
  canEdit?: boolean
}

function ThemeCardHeader({ card }: { card: ThemeOverviewCard }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <h3 className="text-base font-semibold text-foreground leading-snug pr-2">{card.name}</h3>
      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
        {card.quarterLabel ? (
          <Badge variant="outline" className="text-[11px] font-medium px-2 py-0">
            {card.quarterLabel}
          </Badge>
        ) : null}
        {card.isCurrentQuarter ? (
          <Badge className="text-[11px] font-medium px-2 py-0 bg-accent-link/90 hover:bg-accent-link/90">
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
  return (
    <article
      className={cn(
        "flex flex-col rounded-card-lg border bg-card shadow-card transition-shadow",
        isSecondary ? "border-border/50 opacity-[0.92]" : "border-border/60",
        card.isCurrentQuarter && !isSecondary && "ring-2 ring-accent-link/25 shadow-md"
      )}
      style={{ borderLeftWidth: 4, borderLeftColor: card.accentColor }}
    >
      <button
        type="button"
        onClick={() => onOpenTheme(card.id)}
        className="flex flex-col gap-2 p-4 text-left hover:bg-muted/30 rounded-t-card-lg transition-colors w-full"
      >
        <ThemeCardHeader card={card} />
        {card.coreTitle ? (
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">
              Core focus
            </p>
            <p className="text-sm font-medium text-foreground leading-snug whitespace-pre-wrap">
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

      <div className="border-t border-border/40 px-4 py-3 mt-auto">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
          Content prompts
        </p>
        {card.prompts.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {card.prompts.map((prompt) => (
              <li key={prompt.id}>
                <button
                  type="button"
                  onClick={() => onOpenPrompt(prompt.id)}
                  className="w-full text-left text-sm text-foreground/90 rounded-md px-2.5 py-1.5 bg-muted/40 hover:bg-muted/70 transition-colors"
                >
                  <span className="inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle bg-foreground/40" />
                  {prompt.label}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No prompts added yet</p>
        )}
        {canEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 h-8 px-2 text-xs text-accent-link hover:text-accent-link"
            onClick={() => onAddPrompt(card.id)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add prompt
          </Button>
        ) : null}
      </div>
    </article>
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
    <button
      type="button"
      onClick={() => onOpenTheme(card.id)}
      className="w-full text-left rounded-card-lg border border-border/60 bg-card shadow-card p-5 hover:bg-muted/20 transition-colors"
      style={{ borderTopWidth: 4, borderTopColor: card.accentColor }}
    >
      <ThemeCardHeader card={card} />
      <p className="mt-2 text-xs text-muted-foreground">
        Current quarter · {quarterLabel(currentQuarter as 1 | 2 | 3 | 4)} {year}
      </p>
      {card.coreTitle ? (
        <div className="mt-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">
            Core focus
          </p>
          <p className="text-lg font-semibold text-foreground leading-snug whitespace-pre-wrap">
            {card.coreTitle}
          </p>
        </div>
      ) : null}
      {card.description ? (
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {card.description}
        </p>
      ) : null}
    </button>
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
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" text="Loading themes…" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-card-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
        {error}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 md:gap-6 min-w-0">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Theme overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Quarterly themes, core focus, and content prompts for the year
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[120px] h-9 text-sm" aria-label="Planning year">
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
          <Badge variant="secondary" className="h-9 px-3 text-sm font-medium rounded-md">
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
        <div className="rounded-card-lg border border-dashed border-border/60 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
          No theme is set for {quarterLabel(currentQuarter)} {selectedYear}. Add or link a quarterly
          theme for this period.
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">
          Annual themes · {selectedYear}
        </h2>
        {cards.length === 0 ? (
          <div className="rounded-card-lg border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            No themes found for {selectedYear}. Create quarterly themes in your Themes table.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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
        <p className="text-xs text-muted-foreground/80">
          Content prompts need a link field from Content to Quarterly Themes (e.g. quarterly_theme).
          Prompts cannot be grouped until that field exists.
        </p>
      ) : null}
    </div>
  )
}
