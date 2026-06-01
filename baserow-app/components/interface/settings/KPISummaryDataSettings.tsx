"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { BlockConfig } from "@/lib/interface/types"
import type { DataSettingsCtx } from "./blockSettingsRegistry"
import {
  DEFAULT_KPI_SUMMARY_CARDS,
  type KpiSummaryCardConfig,
} from "@/lib/interface/kpi-summary-defaults"
import MarketingDataSourceSection from "./shared/MarketingDataSourceSection"
import KpiSummaryCardEditor from "./KpiSummaryCardEditor"

export default function KPISummaryDataSettings({
  config,
  tables,
  views,
  fields,
  onUpdate,
  onTableChange,
}: DataSettingsCtx) {
  const cards = (config.kpi_summary_cards?.length
    ? config.kpi_summary_cards
    : DEFAULT_KPI_SUMMARY_CARDS) as KpiSummaryCardConfig[]

  const setCards = (next: KpiSummaryCardConfig[]) => {
    onUpdate({ kpi_summary_cards: next })
  }

  const updateCard = (index: number, card: KpiSummaryCardConfig) => {
    const next = [...cards]
    next[index] = card
    setCards(next)
  }

  const addCard = () => {
    const id = `kpi-${Date.now()}`
    setCards([
      ...cards,
      {
        id,
        label: "New metric",
        icon: "barchart",
        accent: "purple",
        table_source: "content",
        kpi_aggregate: "count",
        comparison_preset: "none",
        number_format: "standard",
      },
    ])
  }

  const removeCard = (index: number) => {
    if (cards.length <= 1) return
    setCards(cards.filter((_, i) => i !== index))
  }

  const resetDefaults = () => {
    setCards([...DEFAULT_KPI_SUMMARY_CARDS])
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="kpi-summary-title">Block title</Label>
        <Input
          id="kpi-summary-title"
          value={config.title || ""}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Marketing Overview"
        />
      </div>

      <MarketingDataSourceSection
        config={config}
        tables={tables}
        views={views}
        onUpdate={onUpdate}
        onTableChange={onTableChange}
        mockConfigKey="kpi_summary_use_mock"
        showView={false}
        tableLabel="Default source table (optional)"
      />

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-4">
        <div>
          <p className="text-sm font-medium">KPI cards</p>
          <p className="text-xs text-muted-foreground">
            Each card loads live counts or aggregates from your tables. Use filters to narrow
            metrics (e.g. active campaigns only).
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={resetDefaults}>
            Reset defaults
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={addCard}>
            Add card
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {cards.map((card, index) => (
          <KpiSummaryCardEditor
            key={card.id}
            card={card}
            index={index}
            tables={tables}
            fields={fields}
            onChange={(updated) => updateCard(index, updated)}
            onRemove={() => removeCard(index)}
            canRemove={cards.length > 1}
          />
        ))}
      </div>
    </div>
  )
}
