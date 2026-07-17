"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BlockConfig } from "@/lib/interface/types"
import type { DataSettingsCtx } from "./blockSettingsRegistry"
import MarketingDataSourceSection from "./shared/MarketingDataSourceSection"
import MarketingFieldMappingSection from "./shared/MarketingFieldMappingSection"
import MarketingFieldSelect from "./shared/MarketingFieldSelect"

export default function ContentThemeDataSettings({
  config,
  tables,
  views,
  fields,
  onUpdate,
  onTableChange,
}: DataSettingsCtx) {
  const tableFields = config.table_id
    ? fields.filter((f) => f.table_id === config.table_id)
    : fields

  const setField = (idKey: keyof BlockConfig) =>
    (fieldId: string | undefined) => {
      onUpdate({ [idKey]: fieldId } as Partial<BlockConfig>)
    }

  return (
    <div className="space-y-4">
      <MarketingDataSourceSection
        config={config}
        tables={tables}
        views={views}
        onUpdate={onUpdate}
        onTableChange={onTableChange}
        mockConfigKey="content_theme_use_mock"
        showView={false}
        tableLabel="Quarterly Themes table"
      />

      {config.table_id ? (
        <MarketingFieldMappingSection>
          <MarketingFieldSelect
            label="Theme name"
            fieldId={config.content_theme_name_field_id}
            fields={tableFields}
            onChange={setField("content_theme_name_field_id")}
          />
          <MarketingFieldSelect
            label="Quarter"
            fieldId={config.content_theme_quarter_field_id}
            fields={tableFields}
            onChange={setField("content_theme_quarter_field_id")}
          />
          <MarketingFieldSelect
            label="Year"
            fieldId={config.content_theme_year_field_id}
            fields={tableFields}
            onChange={setField("content_theme_year_field_id")}
          />
          <MarketingFieldSelect
            label="Colour"
            fieldId={config.content_theme_colour_field_id}
            fields={tableFields}
            onChange={setField("content_theme_colour_field_id")}
          />
          <MarketingFieldSelect
            label="Divisions"
            fieldId={config.content_theme_divisions_field_id}
            fields={tableFields}
            onChange={setField("content_theme_divisions_field_id")}
          />
        </MarketingFieldMappingSection>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="content-theme-title">Block title</Label>
        <Input
          id="content-theme-title"
          value={config.title || ""}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Content Themes"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="content-theme-subtitle">Subtitle</Label>
        <Input
          id="content-theme-subtitle"
          value={config.content_theme_subtitle || ""}
          onChange={(e) => onUpdate({ content_theme_subtitle: e.target.value })}
          placeholder="Strategic themes and content focus areas for the quarter."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="content-theme-year">Selected year</Label>
          <Input
            id="content-theme-year"
            type="number"
            min={2020}
            max={2100}
            value={config.content_theme_year ?? 2026}
            onChange={(e) =>
              onUpdate({ content_theme_year: parseInt(e.target.value, 10) || 2026 })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Selected quarter</Label>
          <Select
            value={config.content_theme_quarter || "Q2"}
            onValueChange={(v) => onUpdate({ content_theme_quarter: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Q1", "Q2", "Q3", "Q4"].map((q) => (
                <SelectItem key={q} value={q}>
                  {q}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>View mode</Label>
        <Select
          value={config.content_theme_view_mode || "grid"}
          onValueChange={(v) =>
            onUpdate({ content_theme_view_mode: v as BlockConfig["content_theme_view_mode"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="grid">Grid</SelectItem>
            <SelectItem value="list">List</SelectItem>
            <SelectItem value="compact">Compact</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Card density</Label>
        <Select
          value={config.content_theme_card_density || "comfortable"}
          onValueChange={(v) =>
            onUpdate({
              content_theme_card_density: v as BlockConfig["content_theme_card_density"],
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="comfortable">Comfortable</SelectItem>
            <SelectItem value="compact">Compact</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="content-theme-max">Max themes to show</Label>
        <Input
          id="content-theme-max"
          type="number"
          min={1}
          max={12}
          value={config.content_theme_max_themes ?? 4}
          onChange={(e) =>
            onUpdate({ content_theme_max_themes: parseInt(e.target.value, 10) || 4 })
          }
        />
      </div>

      <div className="space-y-3 rounded-lg border border-gray-200 p-3">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="show-filters" className="font-normal">
            Show filters
          </Label>
          <Switch
            id="show-filters"
            checked={config.content_theme_show_filters !== false}
            onCheckedChange={(v) => onUpdate({ content_theme_show_filters: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="show-view" className="font-normal">
            Show view toggle
          </Label>
          <Switch
            id="show-view"
            checked={config.content_theme_show_view_toggle !== false}
            onCheckedChange={(v) => onUpdate({ content_theme_show_view_toggle: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="show-footer" className="font-normal">
            Show footer
          </Label>
          <Switch
            id="show-footer"
            checked={config.content_theme_show_footer !== false}
            onCheckedChange={(v) => onUpdate({ content_theme_show_footer: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="highlight-quarter" className="font-normal">
            Highlight current quarter
          </Label>
          <Switch
            id="highlight-quarter"
            checked={config.content_theme_highlight_current_quarter !== false}
            onCheckedChange={(v) => onUpdate({ content_theme_highlight_current_quarter: v })}
          />
        </div>
      </div>

    </div>
  )
}
