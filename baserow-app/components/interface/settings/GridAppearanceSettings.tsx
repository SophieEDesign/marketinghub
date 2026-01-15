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
import { X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { BlockConfig } from "@/lib/interface/types"
import type { TableField } from "@/types/fields"

interface GridAppearanceSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig['appearance']>) => void
  fields?: TableField[] // Optional: fields passed from SettingsPanel
}

export default function GridAppearanceSettings({
  config,
  onUpdate,
  fields: fieldsProp,
}: GridAppearanceSettingsProps) {
  const appearance = config.appearance || {}
  const [fields, setFields] = useState<TableField[]>([])
  
  // Use fields prop if provided, otherwise load them
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
      
      if (!error && data) {
        setFields(data as TableField[])
      }
    } catch (error) {
      console.error("Error loading fields:", error)
    }
  }
  
  // Get single-select fields for color field selector
  const selectFields = fields.filter(f => 
    f.type === 'single_select' || f.type === 'multi_select'
  )
  
  // Get attachment/image fields for image field selector
  const imageFields = fields.filter(f => 
    f.type === 'attachment' || f.type === 'url' // URL can contain image URLs
  )

  // Get view type from config to show view-specific settings
  const viewType = (config as any)?.view_type || 'grid'

  // Calendar card fields (two-row display)
  // Stored as appearance.calendar_card_field_1 / appearance.calendar_card_field_2 (field names).
  // Row 1 can be "Default title" (undefined).
  const calendarCardField1 = (appearance as any).calendar_card_field_1 || "__none__"
  const calendarCardField2 = (appearance as any).calendar_card_field_2 || "__none__"
  const availableCalendarCardFields = fields.filter(
    (f) =>
      f.name !== "id" &&
      f.name !== "created_at" &&
      f.name !== "updated_at" &&
      f.type !== "attachment"
  )

  function updateCalendarCardFields(next1: string | "__none__", next2: string | "__none__") {
    const f1 = next1 === "__none__" ? undefined : next1
    let f2 = next2 === "__none__" ? undefined : next2
    // Avoid duplicates (if user picks the same field twice, drop row 2)
    if (f1 && f2 && f1 === f2) f2 = undefined
    onUpdate({
      calendar_card_field_1: f1,
      calendar_card_field_2: f2 || undefined,
    } as any)
  }

  return (
    <div className="space-y-4">
      {/* Row Height / Density */}
      <div className="space-y-2">
        <Label>Row Height</Label>
        <Select
          value={appearance.row_height || "standard"}
          onValueChange={(value) => onUpdate({ row_height: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="compact">Compact</SelectItem>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectItem value="comfortable">Comfortable</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">
          {viewType === 'timeline' || viewType === 'calendar'
            ? "Control the vertical spacing of rows/lanes and card padding"
            : "Control the height of rows in the grid view. Applies to all rows in the block."}
        </p>
      </div>

      {/* Text Wrapping - Only for grid view */}
      {viewType === 'grid' && (
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="wrap-text">Wrap cell text</Label>
            <p className="text-xs text-gray-500 mt-1">
              When enabled, text wraps within column width. When disabled, text is single-line with ellipsis.
            </p>
          </div>
          <Switch
            id="wrap-text"
            checked={appearance.wrap_text || false}
            onCheckedChange={(checked) => onUpdate({ wrap_text: checked })}
          />
        </div>
      )}

      {/* Title Wrapping - For Timeline and Calendar */}
      {(viewType === 'timeline' || viewType === 'calendar') && (
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="wrap-title">Wrap title text</Label>
            <p className="text-xs text-gray-500 mt-1">
              Allow card titles to wrap to multiple lines instead of truncating
            </p>
          </div>
          <Switch
            id="wrap-title"
            checked={appearance.timeline_wrap_title || appearance.card_wrap_title || false}
            onCheckedChange={(checked) => onUpdate({ 
              timeline_wrap_title: checked,
              card_wrap_title: checked
            })}
          />
        </div>
      )}

      {/* Show Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="show-toolbar">Show Toolbar</Label>
          <p className="text-xs text-gray-500 mt-1">
            Display filter, search, and sort controls above the grid
          </p>
        </div>
        <Switch
          id="show-toolbar"
          checked={appearance.show_toolbar !== false}
          onCheckedChange={(checked) => onUpdate({ show_toolbar: checked })}
        />
      </div>

      {/* Add Record Button */}
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="show-add-record">Show &quot;Add record&quot; button</Label>
          <p className="text-xs text-gray-500 mt-1">
            Display an add button inside this block (Grid, Calendar, Kanban, Timeline, Gallery, List)
          </p>
        </div>
        <Switch
          id="show-add-record"
          checked={(appearance as any).show_add_record === true}
          onCheckedChange={(checked) => onUpdate({ show_add_record: checked } as any)}
        />
      </div>

      {/* Show Search */}
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="show-search">Show Search</Label>
          <p className="text-xs text-gray-500 mt-1">
            Display search bar in the toolbar
          </p>
        </div>
        <Switch
          id="show-search"
          checked={appearance.show_search !== false}
          onCheckedChange={(checked) => onUpdate({ show_search: checked })}
        />
      </div>

      {/* Show Filter */}
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="show-filter">Show Filter</Label>
          <p className="text-xs text-gray-500 mt-1">
            Display filter button and controls in the toolbar
          </p>
        </div>
        <Switch
          id="show-filter"
          checked={appearance.show_filter !== false}
          onCheckedChange={(checked) => onUpdate({ show_filter: checked })}
        />
      </div>

      {/* Show Sort */}
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="show-sort">Show Sort</Label>
          <p className="text-xs text-gray-500 mt-1">
            Display sort controls in the toolbar
          </p>
        </div>
        <Switch
          id="show-sort"
          checked={appearance.show_sort !== false}
          onCheckedChange={(checked) => onUpdate({ show_sort: checked })}
        />
      </div>

      {/* Appearance Section */}
      <div className="border-t pt-4 mt-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Appearance</h3>
          <p className="text-xs text-gray-500 mb-4">Configure colors and images for rows, cards, and events</p>
        </div>

        {/* Calendar card fields (two-row cards) */}
        {viewType === "calendar" && (
          <div className="space-y-3">
            <div>
              <Label>Calendar card fields</Label>
              <p className="text-xs text-gray-500 mt-1">
                Choose up to 2 fields to show on each calendar card (two-row view). Leave empty to show the default title only.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-2">
                <Label className="text-xs text-gray-600">Row 1</Label>
                <Select
                  value={calendarCardField1}
                  onValueChange={(value) => updateCalendarCardFields(value as any, calendarCardField2 as any)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select field..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Default title</SelectItem>
                    {availableCalendarCardFields.map((field) => (
                      <SelectItem key={field.id} value={field.name}>
                        {field.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-gray-600">Row 2 (optional)</Label>
                <Select
                  value={calendarCardField2}
                  onValueChange={(value) => updateCalendarCardFields(calendarCardField1 as any, value as any)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select field..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {availableCalendarCardFields.map((field) => (
                      <SelectItem key={field.id} value={field.name}>
                        {field.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Image Field */}
        <div className="space-y-2">
          <Label>{viewType === 'gallery' ? 'Cover image field *' : 'Image field'}</Label>
          <div className="relative">
            <Select
              value={appearance.image_field || "__none__"}
              onValueChange={(value) => onUpdate({ image_field: value === "__none__" ? undefined : value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select image field..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {imageFields.map((field) => (
                  <SelectItem key={field.id} value={field.name}>
                    {field.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {appearance.image_field && (
              <button
                onClick={() => onUpdate({ image_field: undefined })}
                className="absolute right-8 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                type="button"
              >
                <X className="h-3 w-3 text-gray-400" />
              </button>
            )}
          </div>
          {viewType === 'gallery' && !appearance.image_field && (
            <p className="text-xs text-amber-600">
              Gallery view needs a cover image field. Select an attachment or URL field.
            </p>
          )}
          {appearance.image_field && (
            <div className="flex items-center justify-between">
              <Label htmlFor="fit-image-size" className="text-xs text-gray-600">
                Fit image size
              </Label>
              <Switch
                id="fit-image-size"
                checked={appearance.fit_image_size || false}
                onCheckedChange={(checked) => onUpdate({ fit_image_size: checked })}
              />
            </div>
          )}
        </div>

        {/* Color Field */}
        <div className="space-y-2">
          <Label>Color</Label>
          <div className="relative">
            <Select
              value={appearance.color_field || "__none__"}
              onValueChange={(value) => onUpdate({ color_field: value === "__none__" ? undefined : value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select color field..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {selectFields.map((field) => (
                  <SelectItem key={field.id} value={field.name}>
                    {field.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {appearance.color_field && (
              <button
                onClick={() => onUpdate({ color_field: undefined })}
                className="absolute right-8 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                type="button"
              >
                <X className="h-3 w-3 text-gray-400" />
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Use colors from single-select field choices. Colors will be applied to rows, cards, or events.
          </p>
        </div>
      </div>

      {/* Record Opening Section - Only for grid view */}
      {viewType === 'grid' && (
        <div className="border-t pt-4 mt-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Record Opening</h3>
            <p className="text-xs text-gray-500 mb-4">Configure how users can open records from the table</p>
          </div>

          {/* Enable Record Opening */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enable-record-open">Enable record opening</Label>
              <p className="text-xs text-gray-500 mt-1">
                Show a control to open records. When disabled, records cannot be opened from this table.
              </p>
            </div>
            <Switch
              id="enable-record-open"
              checked={appearance.enable_record_open !== false}
              onCheckedChange={(checked) => onUpdate({ enable_record_open: checked })}
            />
          </div>

          {/* Record Open Style - Only show if enabled */}
          {appearance.enable_record_open !== false && (
            <div className="space-y-2">
              <Label>Open style</Label>
              <Select
                value={appearance.record_open_style || "side_panel"}
                onValueChange={(value) => onUpdate({ record_open_style: value as 'side_panel' | 'modal' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="side_panel">Side panel</SelectItem>
                  <SelectItem value="modal">Modal</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {appearance.record_open_style === 'modal'
                  ? "Records open in a full-screen modal overlay"
                  : "Records open in a side panel (desktop) or modal (mobile)"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

