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

        {/* Calendar card fields */}
        {viewType === "calendar" && (
          <div className="space-y-3">
            <div>
              <Label>Calendar card fields</Label>
              <p className="text-xs text-gray-500 mt-1">
                Calendar cards use the ordered <span className="font-medium">Fields to Show on Cards/Table</span> selection.
                Only the first <span className="font-medium">3</span> fields are shown on each event to keep cards compact.
              </p>
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

