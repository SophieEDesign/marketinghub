"use client"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BlockConfig } from "@/lib/interface/types"

interface GridAppearanceSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig['appearance']>) => void
}

export default function GridAppearanceSettings({
  config,
  onUpdate,
}: GridAppearanceSettingsProps) {
  const appearance = config.appearance || {}

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
    </div>
  )
}

