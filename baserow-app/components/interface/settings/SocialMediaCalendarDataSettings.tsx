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
import BlockFilterEditor from "./BlockFilterEditor"
import SortSelector from "./shared/SortSelector"

export default function SocialMediaCalendarDataSettings({
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
  const blockFilters = Array.isArray(config.filters) ? config.filters : []

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
        mockConfigKey="social_media_calendar_use_mock"
        showView={false}
      />

      {config.table_id ? (
        <MarketingFieldMappingSection>
          <MarketingFieldSelect
            label="Title"
            fieldId={config.social_media_calendar_title_field_id}
            fieldName={config.social_media_calendar_title_field}
            fields={tableFields}
            onChange={setField(
              "social_media_calendar_title_field_id",
              "social_media_calendar_title_field"
            )}
          />
          <MarketingFieldSelect
            label="Publish date"
            fieldId={config.social_media_calendar_publish_date_field_id}
            fieldName={config.social_media_calendar_publish_date_field}
            fields={tableFields}
            onChange={setField(
              "social_media_calendar_publish_date_field_id",
              "social_media_calendar_publish_date_field"
            )}
            fieldTypes={["date"]}
          />
          <MarketingFieldSelect
            label="Status"
            fieldId={config.social_media_calendar_status_field_id}
            fieldName={config.social_media_calendar_status_field}
            fields={tableFields}
            onChange={setField(
              "social_media_calendar_status_field_id",
              "social_media_calendar_status_field"
            )}
          />
          <MarketingFieldSelect
            label="Content type"
            fieldId={config.social_media_calendar_type_field_id}
            fieldName={config.social_media_calendar_type_field}
            fields={tableFields}
            onChange={setField(
              "social_media_calendar_type_field_id",
              "social_media_calendar_type_field"
            )}
          />
          <MarketingFieldSelect
            label="Caption"
            fieldId={config.social_media_calendar_caption_field_id}
            fieldName={config.social_media_calendar_caption_field}
            fields={tableFields}
            onChange={setField(
              "social_media_calendar_caption_field_id",
              "social_media_calendar_caption_field"
            )}
          />
          <MarketingFieldSelect
            label="Platform"
            fieldId={config.social_media_calendar_platform_field_id}
            fieldName={config.social_media_calendar_platform_field}
            fields={tableFields}
            onChange={setField(
              "social_media_calendar_platform_field_id",
              "social_media_calendar_platform_field"
            )}
          />
          <MarketingFieldSelect
            label="Owner"
            fieldId={config.social_media_calendar_owner_field_id}
            fieldName={config.social_media_calendar_owner_field}
            fields={tableFields}
            onChange={setField(
              "social_media_calendar_owner_field_id",
              "social_media_calendar_owner_field"
            )}
          />
          <MarketingFieldSelect
            label="Campaign"
            fieldId={config.social_media_calendar_campaign_field_id}
            fieldName={config.social_media_calendar_campaign_field}
            fields={tableFields}
            onChange={setField(
              "social_media_calendar_campaign_field_id",
              "social_media_calendar_campaign_field"
            )}
          />
          <MarketingFieldSelect
            label="Theme"
            fieldId={config.social_media_calendar_theme_field_id}
            fieldName={config.social_media_calendar_theme_field}
            fields={tableFields}
            onChange={setField(
              "social_media_calendar_theme_field_id",
              "social_media_calendar_theme_field"
            )}
          />
          <MarketingFieldSelect
            label="Image / media"
            fieldId={config.social_media_calendar_image_field_id}
            fieldName={config.social_media_calendar_image_field}
            fields={tableFields}
            onChange={setField(
              "social_media_calendar_image_field_id",
              "social_media_calendar_image_field"
            )}
          />
          <MarketingFieldSelect
            label="Planable / post URL"
            fieldId={config.social_media_calendar_post_url_field_id}
            fieldName={config.social_media_calendar_post_url_field}
            fields={tableFields}
            onChange={setField(
              "social_media_calendar_post_url_field_id",
              "social_media_calendar_post_url_field"
            )}
          />
        </MarketingFieldMappingSection>
      ) : null}

      {config.table_id && tableFields.length > 0 ? (
        <div className="space-y-4 pt-2 border-t border-border/40">
          <SortSelector
            value={Array.isArray(config.sorts) ? config.sorts : undefined}
            onChange={(sorts) => onUpdate({ sorts: sorts as BlockConfig["sorts"] })}
            fields={tableFields}
            allowMultiple
          />
          <BlockFilterEditor
            filters={blockFilters}
            tableFields={tableFields}
            config={config}
            onChange={(filters) => onUpdate({ filters })}
            onConfigUpdate={(updates) => onUpdate(updates)}
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="smc-title">Block title</Label>
        <Input
          id="smc-title"
          value={config.title || ""}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Social Media Calendar"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="smc-subtitle">Subtitle</Label>
        <Input
          id="smc-subtitle"
          value={config.social_media_calendar_subtitle || ""}
          onChange={(e) => onUpdate({ social_media_calendar_subtitle: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Default view</Label>
        <Select
          value={config.social_media_calendar_default_view || "month"}
          onValueChange={(v) =>
            onUpdate({
              social_media_calendar_default_view:
                v as BlockConfig["social_media_calendar_default_view"],
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Month</SelectItem>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="list">List</SelectItem>
            <SelectItem value="feed">Feed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="smc-content-type-default">Content type default (new posts)</Label>
        <Input
          id="smc-content-type-default"
          value={config.social_media_calendar_content_type_default || ""}
          onChange={(e) =>
            onUpdate({
              social_media_calendar_content_type_default: e.target.value || undefined,
            })
          }
          placeholder="Social Media"
        />
        <p className="text-[11px] text-muted-foreground leading-snug">
          Used when content scope is Social only. Block filters still apply first (e.g. content
          type = Social Media).
        </p>
      </div>

      <div className="space-y-2">
        <Label>Content scope</Label>
        <Select
          value={config.social_media_calendar_content_scope || "social_only"}
          onValueChange={(v) =>
            onUpdate({
              social_media_calendar_content_scope:
                v as BlockConfig["social_media_calendar_content_scope"],
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="social_only">Social only</SelectItem>
            <SelectItem value="all_content">All content</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {config.table_id ? (
        <div className="space-y-3 rounded-md border border-border/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">Social-only matching rule</p>
          <MarketingFieldSelect
            label="Match field (optional)"
            fieldId={config.social_media_calendar_social_marker_field_id}
            fieldName={config.social_media_calendar_social_marker_field}
            fields={tableFields}
            onChange={setField(
              "social_media_calendar_social_marker_field_id",
              "social_media_calendar_social_marker_field"
            )}
          />
          <div className="space-y-2">
            <Label htmlFor="smc-social-marker-value">Match value</Label>
            <Input
              id="smc-social-marker-value"
              value={config.social_media_calendar_social_marker_value || ""}
              onChange={(e) =>
                onUpdate({
                  social_media_calendar_social_marker_value: e.target.value || undefined,
                })
              }
              placeholder="e.g. Social Media"
            />
            <p className="text-[11px] text-muted-foreground leading-snug">
              When Social only is active, records are included when this field contains this value.
              Leave blank to use automatic social detection.
            </p>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Default: Auto detect using content type/platform signals (no explicit match rule).
            </p>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>Mode</Label>
        <Select
          value={config.social_media_calendar_mode || "full"}
          onValueChange={(v) =>
            onUpdate({
              social_media_calendar_mode: v as BlockConfig["social_media_calendar_mode"],
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="full">Full</SelectItem>
            <SelectItem value="compact">Compact</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="smc-max">Max posts (compact)</Label>
        <Input
          id="smc-max"
          type="number"
          min={0}
          placeholder="No limit"
          value={
            config.social_media_calendar_max_posts != null
              ? String(config.social_media_calendar_max_posts)
              : ""
          }
          onChange={(e) => {
            const n = e.target.value === "" ? undefined : Number(e.target.value)
            onUpdate({ social_media_calendar_max_posts: n })
          }}
        />
      </div>

      <div className="space-y-3 pt-2 border-t border-border/30">
        <p className="text-xs font-medium text-muted-foreground">Filters & view controls</p>
        {(
          [
            ["social_media_calendar_show_search", "Search", true],
            ["social_media_calendar_show_toolbar", "Toolbar & scope toggle", true],
            ["social_media_calendar_show_filters", "Filter row", true],
            ["social_media_calendar_show_status_bar", "Status bar", true],
            ["social_media_calendar_show_media_preview", "Quick preview panel", true],
            ["social_media_calendar_show_approval_status", "Status pills", true],
            ["social_media_calendar_show_platform_icons", "Platform icons", true],
            ["social_media_calendar_show_page_header", "Page-style header (hide block title)", false],
          ] as const
        ).map(([key, label, defaultOn]) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <Label htmlFor={key} className="text-sm font-normal">
              {label}
            </Label>
            <Switch
              id={key}
              checked={(config as Record<string, boolean | undefined>)[key] ?? defaultOn}
              onCheckedChange={(checked) => onUpdate({ [key]: checked })}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
