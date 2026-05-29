"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BlockConfig, UpcomingSummarySectionId } from "@/lib/interface/types"
import type { DataSettingsCtx } from "./blockSettingsRegistry"
import { ALL_UPCOMING_SUMMARY_SECTIONS } from "@/lib/interface/upcoming-summary-mock-data"
import TableSelector from "./shared/TableSelector"
import MarketingFieldMappingSection from "./shared/MarketingFieldMappingSection"
import MarketingFieldSelect from "./shared/MarketingFieldSelect"

const SECTION_LABELS: Record<UpcomingSummarySectionId, string> = {
  deadlines: "Upcoming deadlines",
  campaigns: "Upcoming campaigns",
  events: "Upcoming events",
  approval: "Awaiting approval",
  blockers: "Blockers / missing items",
  published: "Recently published",
}

export default function UpcomingSummaryDataSettings({
  config,
  tables,
  fields,
  onUpdate,
}: DataSettingsCtx) {
  const contentTableId = config.upcoming_summary_content_table_id || config.table_id
  const contentFields = contentTableId
    ? fields.filter((f) => f.table_id === contentTableId)
    : fields

  const setField =
    (idKey: keyof BlockConfig, nameKey?: keyof BlockConfig) =>
    (fieldId: string | undefined, fieldName?: string | undefined) => {
      onUpdate({
        [idKey]: fieldId,
        ...(nameKey ? { [nameKey]: fieldName } : {}),
      } as Partial<BlockConfig>)
    }
  const sections =
    config.upcoming_summary_sections?.length
      ? config.upcoming_summary_sections
      : [...ALL_UPCOMING_SUMMARY_SECTIONS]

  const toggleSection = (id: UpcomingSummarySectionId, checked: boolean) => {
    const next = checked
      ? [...new Set([...sections, id])]
      : sections.filter((s) => s !== id)
    onUpdate({ upcoming_summary_sections: next })
  }

  return (
    <div className="space-y-4">
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-sm text-blue-800">
          Loads from Content (deadlines, approvals, blockers, published, events) and Campaigns.
          Configure source tables directly or let the block discover by table name. Click a row in view mode to open the record.
        </p>
      </div>

      <details className="rounded-lg border border-border/40">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Data sources</summary>
        <div className="space-y-3 border-t border-border/40 p-3">
          <TableSelector
            label="Content table"
            value={config.upcoming_summary_content_table_id || config.table_id || ""}
            onChange={(id) =>
              onUpdate({
                upcoming_summary_content_table_id: id || undefined,
                table_id: id || undefined,
              })
            }
            tables={tables}
            required={false}
          />
          <TableSelector
            label="Campaigns table"
            value={config.upcoming_summary_campaigns_table_id || ""}
            onChange={(id) => onUpdate({ upcoming_summary_campaigns_table_id: id || undefined })}
            tables={tables}
            required={false}
          />
        </div>
      </details>

      {contentTableId && contentFields.length > 0 ? (
        <MarketingFieldMappingSection>
          <MarketingFieldSelect
            label="Title"
            fieldId={config.upcoming_summary_title_field_id}
            fieldName={config.upcoming_summary_title_field}
            fields={contentFields}
            onChange={setField("upcoming_summary_title_field_id", "upcoming_summary_title_field")}
          />
          <MarketingFieldSelect
            label="Content type"
            fieldId={config.upcoming_summary_type_field_id}
            fieldName={config.upcoming_summary_type_field}
            fields={contentFields}
            onChange={setField("upcoming_summary_type_field_id", "upcoming_summary_type_field")}
          />
          <MarketingFieldSelect
            label="Status"
            fieldId={config.upcoming_summary_status_field_id}
            fieldName={config.upcoming_summary_status_field}
            fields={contentFields}
            onChange={setField("upcoming_summary_status_field_id", "upcoming_summary_status_field")}
          />
          <MarketingFieldSelect
            label="Due date"
            fieldId={config.upcoming_summary_due_date_field_id}
            fieldName={config.upcoming_summary_due_date_field}
            fields={contentFields}
            onChange={setField("upcoming_summary_due_date_field_id", "upcoming_summary_due_date_field")}
            fieldTypes={["date"]}
          />
          <MarketingFieldSelect
            label="Publish date"
            fieldId={config.upcoming_summary_date_field_id}
            fieldName={config.upcoming_summary_date_field}
            fields={contentFields}
            onChange={setField("upcoming_summary_date_field_id", "upcoming_summary_date_field")}
            fieldTypes={["date"]}
          />
          <MarketingFieldSelect
            label="Owner"
            fieldId={config.upcoming_summary_owner_field_id}
            fieldName={config.upcoming_summary_owner_field}
            fields={contentFields}
            onChange={setField("upcoming_summary_owner_field_id", "upcoming_summary_owner_field")}
          />
          <MarketingFieldSelect
            label="Priority"
            fieldId={config.upcoming_summary_priority_field_id}
            fieldName={config.upcoming_summary_priority_field}
            fields={contentFields}
            onChange={setField("upcoming_summary_priority_field_id", "upcoming_summary_priority_field")}
          />
          <MarketingFieldSelect
            label="Theme"
            fieldId={config.upcoming_summary_theme_field_id}
            fieldName={config.upcoming_summary_theme_field}
            fields={contentFields}
            onChange={setField("upcoming_summary_theme_field_id", "upcoming_summary_theme_field")}
          />
        </MarketingFieldMappingSection>
      ) : null}

      <div className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2">
        <div className="space-y-0.5 pr-3">
          <Label htmlFor="us-use-mock">Use demo data</Label>
          <p className="text-xs text-muted-foreground">
            Show sample sections instead of live table data.
          </p>
        </div>
        <Switch
          id="us-use-mock"
          checked={config.upcoming_summary_use_mock === true}
          onCheckedChange={(v) => onUpdate({ upcoming_summary_use_mock: v ? true : undefined })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="upcoming-summary-title">Block title</Label>
        <Input
          id="upcoming-summary-title"
          value={config.title || ""}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Upcoming Summary"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="upcoming-summary-subtitle">Subtitle</Label>
        <Input
          id="upcoming-summary-subtitle"
          value={config.upcoming_summary_subtitle || ""}
          onChange={(e) => onUpdate({ upcoming_summary_subtitle: e.target.value })}
          placeholder="A quick view of deadlines, campaigns and marketing activity needing attention."
        />
      </div>

      <div className="space-y-2">
        <Label>Sections to show</Label>
        <div className="space-y-2 rounded-lg border border-gray-200 p-3">
          {ALL_UPCOMING_SUMMARY_SECTIONS.map((id) => (
            <div key={id} className="flex items-center gap-2">
              <Checkbox
                id={`section-${id}`}
                checked={sections.includes(id)}
                onCheckedChange={(v) => toggleSection(id, v === true)}
              />
              <Label htmlFor={`section-${id}`} className="font-normal cursor-pointer">
                {SECTION_LABELS[id]}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="upcoming-summary-max">Max items per section</Label>
        <Input
          id="upcoming-summary-max"
          type="number"
          min={3}
          max={6}
          value={config.upcoming_summary_max_items ?? 5}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10)
            onUpdate({
              upcoming_summary_max_items: Number.isFinite(n)
                ? Math.max(3, Math.min(6, n))
                : 5,
            })
          }}
        />
      </div>

      <div className="space-y-2">
        <Label>Layout</Label>
        <Select
          value={config.upcoming_summary_layout || "two_column"}
          onValueChange={(v) =>
            onUpdate({
              upcoming_summary_layout: v as BlockConfig["upcoming_summary_layout"],
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="stacked">Single column (stacked)</SelectItem>
            <SelectItem value="two_column">Two column grid</SelectItem>
            <SelectItem value="compact">Compact sidebar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Date range</Label>
        <Select
          value={config.upcoming_summary_date_range || "next_30_days"}
          onValueChange={(v) =>
            onUpdate({
              upcoming_summary_date_range: v as BlockConfig["upcoming_summary_date_range"],
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this_week">This week</SelectItem>
            <SelectItem value="next_30_days">Next 30 days</SelectItem>
            <SelectItem value="this_quarter">This quarter</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3 rounded-lg border border-gray-200 p-3">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="show-counts" className="font-normal">
            Show counts
          </Label>
          <Switch
            id="show-counts"
            checked={config.upcoming_summary_show_counts !== false}
            onCheckedChange={(v) => onUpdate({ upcoming_summary_show_counts: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="show-dates" className="font-normal">
            Show dates
          </Label>
          <Switch
            id="show-dates"
            checked={config.upcoming_summary_show_dates !== false}
            onCheckedChange={(v) => onUpdate({ upcoming_summary_show_dates: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="show-owners" className="font-normal">
            Show owners
          </Label>
          <Switch
            id="show-owners"
            checked={config.upcoming_summary_show_owners !== false}
            onCheckedChange={(v) => onUpdate({ upcoming_summary_show_owners: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="show-view-all" className="font-normal">
            Show &quot;View all&quot; links
          </Label>
          <Switch
            id="show-view-all"
            checked={config.upcoming_summary_show_view_all !== false}
            onCheckedChange={(v) => onUpdate({ upcoming_summary_show_view_all: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="group-campaigns" className="font-normal">
            Group campaigns by status
          </Label>
          <Switch
            id="group-campaigns"
            checked={config.upcoming_summary_group_campaigns_by_status === true}
            onCheckedChange={(v) =>
              onUpdate({ upcoming_summary_group_campaigns_by_status: v })
            }
          />
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Enable demo data only for presentations when tables are unavailable.
      </p>
    </div>
  )
}
