"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import type { BlockConfig } from "@/lib/interface/types"
import type { TableField } from "@/types/fields"
import ConditionalFormattingEditor from "./ConditionalFormattingEditor"

interface GridAppearanceSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig["appearance"]>) => void
  onUpdateConfig?: (updates: Partial<BlockConfig>) => void
  fields?: TableField[]
}

export default function GridAppearanceSettings({
  config,
  onUpdate,
  onUpdateConfig,
  fields: fieldsProp,
}: GridAppearanceSettingsProps) {
  const appearance = config.appearance || {}
  const [fields, setFields] = useState<TableField[]>([])

  useEffect(() => {
    if (fieldsProp) {
      setFields(fieldsProp)
    } else if (config.table_id) {
      loadFields()
    }
  }, [config.table_id, fieldsProp])

  async function loadFields() {
    if (!config.table_id) return
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", config.table_id)
        .order("position", { ascending: true })
      if (!error && data) setFields(data as TableField[])
    } catch (error) {
      console.error("Error loading fields:", error)
    }
  }

  const imageFields = fields.filter(
    (f) => f.type === "attachment" || f.type === "url"
  )
  const viewType = (config as any)?.view_type || "grid"
  const visibleFieldNames = Array.isArray(config.visible_fields) ? config.visible_fields : []

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Display</h3>
        <p className="text-xs text-gray-500 mb-3">How records are shown</p>
      </div>

      {/* Density - all view types */}
      <div className="space-y-2">
        <Label>Density</Label>
        <Select
          value={appearance.row_height || "standard"}
          onValueChange={(value) => onUpdate({ row_height: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {viewType === "list" ? (
              <>
                <SelectItem value="compact">Short</SelectItem>
                <SelectItem value="standard">Medium</SelectItem>
                <SelectItem value="comfortable">Tall</SelectItem>
              </>
            ) : (
              <>
                <SelectItem value="compact">Compact</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="comfortable">Comfortable</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* LIST: wrap long cell values, color, show label */}
      {viewType === "list" && (
        <>
          <div className="flex items-center justify-between">
            <Label htmlFor="list-wrap">Wrap long cell values</Label>
            <Switch
              id="list-wrap"
              checked={appearance.wrap_text || false}
              onCheckedChange={(checked) => onUpdate({ wrap_text: checked })}
            />
          </div>
        </>
      )}

      {/* GRID: keep only controls with active render consumers */}
      {viewType === "grid" && (
        <>
          <div className="border-t pt-4">
            <ConditionalFormattingEditor
              rules={config.highlight_rules || []}
              fields={fields}
              onRulesChange={(rules) => {
                if (onUpdateConfig) onUpdateConfig({ highlight_rules: rules })
              }}
            />
          </div>
        </>
      )}

      {/* GALLERY: image field, fit image size, title field, records shown */}
      {viewType === "gallery" && (
        <>
          <div className="space-y-2">
            <Label>Cover image field *</Label>
            <Select
              value={appearance.image_field || "__none__"}
              onValueChange={(v) => onUpdate({ image_field: v === "__none__" ? undefined : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select image field..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {imageFields.map((f) => (
                  <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!appearance.image_field && (
              <p className="text-xs text-amber-600">Gallery needs a cover image field.</p>
            )}
          </div>
          {appearance.image_field && (
            <div className="flex items-center justify-between">
              <Label>Fit image size</Label>
              <Switch
                checked={appearance.fit_image_size || false}
                onCheckedChange={(c) => onUpdate({ fit_image_size: c })}
              />
            </div>
          )}
          {visibleFieldNames.length > 0 && (
            <div className="space-y-2">
              <Label>Title field (card title)</Label>
              <Select
                value={appearance.gallery_title_field || visibleFieldNames[0] || "__first__"}
                onValueChange={(v) =>
                  onUpdate({ gallery_title_field: v === "__first__" ? undefined : v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__first__">First field in list</SelectItem>
                  {visibleFieldNames.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Records shown</Label>
            <Select
              value={String(appearance.gallery_rows_per_page || "12")}
              onValueChange={(v) =>
                onUpdate({ gallery_rows_per_page: v === "12" ? undefined : parseInt(v, 10) })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6</SelectItem>
                <SelectItem value="12">12</SelectItem>
                <SelectItem value="24">24</SelectItem>
                <SelectItem value="48">48</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {/* KANBAN: image field, fit image size, wrap long values, hide empty stacks, color, show label */}
      {viewType === "kanban" && (
        <>
          <div className="space-y-2">
            <Label>Image field</Label>
            <Select
              value={appearance.image_field || "__none__"}
              onValueChange={(v) => onUpdate({ image_field: v === "__none__" ? undefined : v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {imageFields.map((f) => (
                  <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {appearance.image_field && (
            <div className="flex items-center justify-between">
              <Label>Fit image size</Label>
              <Switch
                checked={appearance.fit_image_size || false}
                onCheckedChange={(c) => onUpdate({ fit_image_size: c })}
              />
            </div>
          )}
          <div className="flex items-center justify-between">
            <Label>Wrap long values</Label>
            <Switch
              checked={appearance.wrap_text || false}
              onCheckedChange={(c) => onUpdate({ wrap_text: c })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Hide empty stacks</Label>
            <Switch
              checked={(appearance as any).kanban_hide_empty_stacks || false}
              onCheckedChange={(c) =>
                onUpdate({ kanban_hide_empty_stacks: c } as any)
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Show field labels</Label>
            <Switch
              checked={(appearance as any).kanban_show_field_labels === true}
              onCheckedChange={(c) =>
                onUpdate({ kanban_show_field_labels: c } as any)
              }
            />
          </div>
        </>
      )}

      {/* CALENDAR: image field, preview field count, color, show label */}
      {viewType === "calendar" && (
        <>
          <div className="space-y-2">
            <Label>Image field</Label>
            <Select
              value={appearance.image_field || "__none__"}
              onValueChange={(v) => onUpdate({ image_field: v === "__none__" ? undefined : v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {imageFields.map((f) => (
                  <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Event fields shown</Label>
            <Select
              value={String((appearance as any).calendar_preview_field_count ?? "3")}
              onValueChange={(v) =>
                onUpdate({ calendar_preview_field_count: v === "3" ? undefined : parseInt(v, 10) } as any)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} fields per event</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {/* TIMELINE: timeline_layout is hidden until render support exists */}

      {/* Grid-only: wrap cell text (legacy) */}
      {viewType === "grid" && (
        <div className="flex items-center justify-between">
          <Label htmlFor="wrap-text">Wrap cell text</Label>
          <Switch
            id="wrap-text"
            checked={appearance.wrap_text || false}
            onCheckedChange={(c) => onUpdate({ wrap_text: c })}
          />
        </div>
      )}

      {/* Colour by field + title controls are consolidated in CommonAppearanceSettings */}
    </div>
  )
}
