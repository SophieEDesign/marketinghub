"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Table, TableField } from "@/types/database"
import type { KpiSummaryCardConfig } from "@/lib/interface/kpi-summary-defaults"
import TableSelector from "./shared/TableSelector"
import BlockFilterEditor from "./BlockFilterEditor"

const TABLE_SOURCES: { value: KpiSummaryCardConfig["table_source"]; label: string }[] = [
  { value: "campaigns", label: "Campaigns (auto)" },
  { value: "content", label: "Content (auto)" },
  { value: "social_posts", label: "Social Posts (auto)" },
  { value: "events", label: "Events (auto)" },
  { value: "media", label: "Media / Resources (auto)" },
]

const ACCENTS: KpiSummaryCardConfig["accent"][] = ["purple", "blue", "red"]

interface KpiSummaryCardEditorProps {
  card: KpiSummaryCardConfig
  index: number
  tables: Table[]
  fields: TableField[]
  onChange: (card: KpiSummaryCardConfig) => void
  onRemove: () => void
  canRemove: boolean
}

export default function KpiSummaryCardEditor({
  card,
  index,
  tables,
  fields,
  onChange,
  onRemove,
  canRemove,
}: KpiSummaryCardEditorProps) {
  const tableId = card.table_id || ""
  const tableFields = tableId
    ? fields.filter((f) => f.table_id === tableId)
    : fields

  const numericFields = tableFields.filter(
    (f) => ["number", "currency", "percent"].includes(f.type) || f.type === "formula"
  )
  const dateFields = tableFields.filter((f) => f.type === "date")

  const patch = (updates: Partial<KpiSummaryCardConfig>) => {
    onChange({ ...card, ...updates })
  }

  return (
    <div className="space-y-3 rounded-md border border-border/50 bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Card {index + 1}</p>
        {canRemove ? (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            Remove
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label>Label</Label>
        <Input
          value={card.label}
          onChange={(e) => patch({ label: e.target.value })}
          placeholder="Metric label"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Icon</Label>
          <Select value={card.icon} onValueChange={(v) => patch({ icon: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rocket">Rocket</SelectItem>
              <SelectItem value="calendar">Calendar</SelectItem>
              <SelectItem value="barchart">Bar chart</SelectItem>
              <SelectItem value="calendardays">Calendar days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Accent</Label>
          <Select
            value={card.accent}
            onValueChange={(v) => patch({ accent: v as KpiSummaryCardConfig["accent"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACCENTS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <TableSelector
        value={tableId}
        onChange={async (id) => {
          patch({
            table_id: id || undefined,
            table_source: id ? undefined : card.table_source,
            kpi_field: undefined,
            kpi_field_id: undefined,
          })
        }}
        tables={tables}
        required={false}
        label="Source table (optional)"
      />

      {!tableId ? (
        <div className="space-y-2">
          <Label>Auto-discover table</Label>
          <Select
            value={card.table_source || "content"}
            onValueChange={(v) =>
              patch({ table_source: v as KpiSummaryCardConfig["table_source"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TABLE_SOURCES.map((s) => (
                <SelectItem key={s.value} value={s.value!}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>Metric</Label>
        <Select
          value={card.kpi_aggregate || "count"}
          onValueChange={(v) =>
            patch({
              kpi_aggregate: v as KpiSummaryCardConfig["kpi_aggregate"],
              kpi_field: v === "count" ? undefined : card.kpi_field,
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="count">Count</SelectItem>
            <SelectItem value="sum">Sum</SelectItem>
            <SelectItem value="avg">Average</SelectItem>
            <SelectItem value="min">Minimum</SelectItem>
            <SelectItem value="max">Maximum</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {card.kpi_aggregate && card.kpi_aggregate !== "count" ? (
        <div className="space-y-2">
          <Label>Numeric field</Label>
          <Select
            value={card.kpi_field_id || card.kpi_field || ""}
            onValueChange={(fieldId) => {
              const field = tableFields.find((f) => f.id === fieldId)
              patch({
                kpi_field_id: fieldId,
                kpi_field: field?.name,
              })
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select field" />
            </SelectTrigger>
            <SelectContent>
              {numericFields.map((field) => (
                <SelectItem key={field.id} value={field.id}>
                  {field.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>Trend comparison</Label>
        <Select
          value={card.comparison_preset || "none"}
          onValueChange={(v) =>
            patch({ comparison_preset: v as KpiSummaryCardConfig["comparison_preset"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="last_7_days">Last 7 days vs prior 7 days</SelectItem>
            <SelectItem value="month_over_month">This month vs last month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(card.comparison_preset || "none") !== "none" && (tableId || card.table_source) ? (
        <div className="space-y-2">
          <Label>Date field for comparison</Label>
          <Select
            value={card.comparison_date_field_id || "__auto__"}
            onValueChange={(fieldId) => {
              if (fieldId === "__auto__") {
                patch({
                  comparison_date_field_id: undefined,
                  comparison_date_field: undefined,
                })
                return
              }
              const field = tableFields.find((f) => f.id === fieldId)
              patch({
                comparison_date_field_id: fieldId,
                comparison_date_field: field?.name,
              })
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Auto-detect if empty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__auto__">Auto-detect</SelectItem>
              {dateFields.map((field) => (
                <SelectItem key={field.id} value={field.id}>
                  {field.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>Number format</Label>
        <Select
          value={card.number_format || "standard"}
          onValueChange={(v) =>
            patch({ number_format: v as KpiSummaryCardConfig["number_format"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectItem value="compact">Compact (e.g. 8.3K)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(tableId || card.table_source) && tableFields.length > 0 ? (
        <BlockFilterEditor
          filters={card.filters || []}
          tableFields={tableFields}
          config={{}}
          onChange={(filters) => patch({ filters })}
        />
      ) : null}
    </div>
  )
}
