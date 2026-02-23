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

  const selectFields = fields.filter(
    (f) => f.type === "single_select" || f.type === "multi_select"
  )
  const imageFields = fields.filter(
    (f) => f.type === "attachment" || f.type === "url"
  )
  const viewType = (config as any)?.view_type || "grid"
  const visibleFieldNames = Array.isArray(config.visible_fields) ? config.visible_fields : []

  return (
    <div className="space-y-4">
      {/* Row height - all view types */}
      <div className="space-y-2">
        <Label>Row height</Label>
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

      {/* GRID: wrap headers, field color, field descriptions, show label */}
      {viewType === "grid" && (
        <>
          <div className="flex items-center justify-between">
            <Label htmlFor="wrap-headers">Wrap headers</Label>
            <Switch
              id="wrap-headers"
              checked={(appearance as any).wrap_headers || false}
              onCheckedChange={(checked) => onUpdate({ wrap_headers: checked } as any)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="grid-field-descriptions">Field descriptions</Label>
            <Switch
              id="grid-field-descriptions"
              checked={(appearance as any).show_field_descriptions || false}
              onCheckedChange={(checked) =>
                onUpdate({ show_field_descriptions: checked } as any)
              }
            />
          </div>
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

      {/* GALLERY: image field, fit image size, title field, rows per page, display field names, color, show label */}
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
            <Label>Rows per page</Label>
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
          <div className="flex items-center justify-between">
            <Label>Display field names</Label>
            <Switch
              checked={(appearance as any).gallery_display_field_names !== false}
              onCheckedChange={(c) =>
                onUpdate({ gallery_display_field_names: c } as any)
              }
            />
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
            <Label>Preview field count</Label>
            <Select
              value={String((appearance as any).calendar_preview_field_count ?? "10")}
              onValueChange={(v) =>
                onUpdate({ calendar_preview_field_count: v === "10" ? undefined : parseInt(v, 10) } as any)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[3, 5, 10, 15, 20].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} visible fields</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {/* TIMELINE: layout only (compact cards use fixed height; colour in Color section below) */}
      {viewType === "timeline" && (
        <div className="space-y-2">
          <Label>Layout</Label>
          <Select
            value={(appearance as any).timeline_layout || "stacked"}
            onValueChange={(v) =>
              onUpdate({ timeline_layout: v as "stacked" | "lanes" } as any)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stacked">Stacked</SelectItem>
              <SelectItem value="lanes">Lanes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

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

      {/* Color - all view types */}
      <div className="border-t pt-4 space-y-2">
        <Label>Color</Label>
        <Select
          value={appearance.color_field || "__none__"}
          onValueChange={(v) => onUpdate({ color_field: v === "__none__" ? undefined : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select color field..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {selectFields.map((f) => (
              <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">
          Use colors from single-select field. Applied to rows, cards, or events.
        </p>
      </div>

      {/* Show label - all (block title/labels) */}
      <div className="flex items-center justify-between">
        <Label htmlFor="show-label">Show label</Label>
        <Switch
          id="show-label"
          checked={appearance.showTitle !== false && (appearance as any).show_title !== false}
          onCheckedChange={(c) =>
            onUpdate({ showTitle: c, show_title: c } as any)
          }
        />
      </div>
    </div>
  )
}
