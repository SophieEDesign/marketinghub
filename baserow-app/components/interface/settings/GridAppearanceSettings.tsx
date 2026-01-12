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

  return (
    <div className="space-y-4">
      {/* Row Height / Density */}
      <div className="space-y-2">
        <Label>Row Size</Label>
        <Select
          value={appearance.row_height || "medium"}
          onValueChange={(value) => onUpdate({ row_height: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="compact">Compact</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="comfortable">Comfortable</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">
          Control the height of rows in the grid view
        </p>
      </div>

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

        {/* Image Field */}
        <div className="space-y-2">
          <Label>Image field</Label>
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
    </div>
  )
}

