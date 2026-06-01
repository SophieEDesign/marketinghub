"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { HUB_CATEGORY_OPTIONS } from "@/components/interface/blocks/internal-resource-hub/types"
import MarketingDataSourceSection from "./shared/MarketingDataSourceSection"
import MarketingFieldMappingSection from "./shared/MarketingFieldMappingSection"
import MarketingFieldSelect from "./shared/MarketingFieldSelect"

export default function InternalResourceHubDataSettings({
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

  const setField = (idKey: keyof BlockConfig, nameKey: keyof BlockConfig) =>
    (fieldId: string | undefined, fieldName: string | undefined) => {
      onUpdate({ [idKey]: fieldId, [nameKey]: fieldName } as Partial<BlockConfig>)
    }

  return (
    <div className="space-y-4">
      <MarketingDataSourceSection
        config={config}
        tables={tables}
        views={views}
        onUpdate={onUpdate}
        onTableChange={onTableChange}
        mockConfigKey="resource_hub_use_mock"
        legacyMockKey="resource_hub_use_dashboard_mock"
        showView={false}
      />

      {config.table_id ? (
        <MarketingFieldMappingSection>
          <MarketingFieldSelect
            label="Title"
            fieldId={config.resource_hub_title_field_id}
            fieldName={config.resource_hub_title_field}
            fields={tableFields}
            onChange={setField("resource_hub_title_field_id", "resource_hub_title_field")}
          />
          <MarketingFieldSelect
            label="File URL"
            fieldId={config.resource_hub_file_url_field_id}
            fieldName={config.resource_hub_file_url_field}
            fields={tableFields}
            onChange={setField("resource_hub_file_url_field_id", "resource_hub_file_url_field")}
          />
          <MarketingFieldSelect
            label="Description"
            fieldId={config.resource_hub_description_field_id}
            fieldName={config.resource_hub_description_field}
            fields={tableFields}
            onChange={setField(
              "resource_hub_description_field_id",
              "resource_hub_description_field"
            )}
          />
          <MarketingFieldSelect
            label="Hub category"
            fieldId={config.resource_hub_category_field_id}
            fieldName={config.resource_hub_category_field}
            fields={tableFields}
            onChange={setField("resource_hub_category_field_id", "resource_hub_category_field")}
            fieldTypes={["single_select"]}
          />
          <MarketingFieldSelect
            label="Uploaded by"
            fieldId={config.resource_hub_uploaded_by_field_id}
            fieldName={config.resource_hub_uploaded_by_field}
            fields={tableFields}
            onChange={setField(
              "resource_hub_uploaded_by_field_id",
              "resource_hub_uploaded_by_field"
            )}
          />
          <MarketingFieldSelect
            label="Updated at"
            fieldId={config.resource_hub_updated_at_field_id}
            fieldName={config.resource_hub_updated_at_field}
            fields={tableFields}
            onChange={setField("resource_hub_updated_at_field_id", "resource_hub_updated_at_field")}
            fieldTypes={["date"]}
          />
        </MarketingFieldMappingSection>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="resource-hub-title">Block title</Label>
        <Input
          id="resource-hub-title"
          value={config.title || ""}
          onChange={(e) => onUpdate({ title: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="resource-hub-subtitle">Subtitle</Label>
        <Input
          id="resource-hub-subtitle"
          value={config.resource_hub_subtitle || ""}
          onChange={(e) => onUpdate({ resource_hub_subtitle: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="resource-hub-max">Max items</Label>
        <Input
          id="resource-hub-max"
          type="number"
          min={0}
          value={config.resource_hub_max_items ?? ""}
          onChange={(e) =>
            onUpdate({
              resource_hub_max_items:
                e.target.value === "" ? undefined : Math.max(0, parseInt(e.target.value, 10) || 0),
            })
          }
        />
      </div>

      <div className="space-y-2">
        <Label>Default category</Label>
        <Select
          value={config.resource_hub_default_category || "all"}
          onValueChange={(v) => onUpdate({ resource_hub_default_category: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HUB_CATEGORY_OPTIONS.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Layout mode</Label>
        <Select
          value={config.resource_hub_layout_mode || "gallery"}
          onValueChange={(v) =>
            onUpdate({ resource_hub_layout_mode: v as BlockConfig["resource_hub_layout_mode"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gallery">Gallery</SelectItem>
            <SelectItem value="preview">Preview</SelectItem>
            <SelectItem value="list">List</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="resource-hub-notice">Internal notice text</Label>
        <Textarea
          id="resource-hub-notice"
          value={config.resource_hub_internal_notice || ""}
          onChange={(e) => onUpdate({ resource_hub_internal_notice: e.target.value })}
          rows={3}
        />
      </div>

      <div className="space-y-3 pt-2 border-t">
        {(
          [
            ["resource_hub_show_search", "Show search", true],
            ["resource_hub_show_filters", "Show filters", true],
            ["resource_hub_show_recent", "Show recent resources", true],
            ["resource_hub_show_upload", "Show upload area (edit mode)", true],
            ["resource_hub_show_detail_panel", "Show detail panel", true],
          ] as const
        ).map(([key, label, defaultOn]) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <Label htmlFor={key} className="font-normal">
              {label}
            </Label>
            <Switch
              id={key}
              checked={(config as Record<string, boolean | undefined>)[key] ?? defaultOn}
              onCheckedChange={(v) => onUpdate({ [key]: v } as Partial<BlockConfig>)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
