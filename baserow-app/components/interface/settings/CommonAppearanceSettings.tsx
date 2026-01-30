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
import type { BlockConfig, BlockType } from "@/lib/interface/types"
import type { TableField } from "@/types/database"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import { getFieldDisplayName } from "@/lib/fields/display"

interface CommonAppearanceSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig['appearance']>) => void
  blockType?: BlockType
  fields?: TableField[] // Optional: fields for color_field selector (for data blocks)
}

export default function CommonAppearanceSettings({
  config,
  onUpdate,
  blockType,
  fields = [],
}: CommonAppearanceSettingsProps) {
  const appearance = config.appearance || {}
  
  // Get single-select and multi-select fields for color field selector
  const selectFields = fields.filter(f => 
    f.type === 'single_select' || f.type === 'multi_select'
  )
  const titleInputValue =
    appearance.title !== undefined
      ? appearance.title
      : blockType === "field"
        ? ""
        : (config.title || "")

  return (
    <div className="space-y-6">
      {/* Header / Title Section */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Header / Title</h3>
          <p className="text-xs text-gray-500 mb-4">Customize the block title appearance</p>
        </div>

        {/* Title Text */}
        <div className="space-y-2">
          <Label>Title</Label>
          <Input
            type="text"
            value={titleInputValue}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Block title"
          />
        </div>

        {/* Show Title */}
        <div className="flex items-center justify-between">
          <Label htmlFor="show-title">Show title</Label>
          <Switch
            id="show-title"
            checked={appearance.showTitle !== false}
            onCheckedChange={(checked) => onUpdate({ showTitle: checked })}
          />
        </div>

        {/* Title Size */}
        {appearance.showTitle !== false && (
          <>
            <div className="space-y-2">
              <Label>Title size</Label>
              <Select
                value={appearance.titleSize || 'medium'}
                onValueChange={(value) =>
                  onUpdate({ titleSize: value as 'small' | 'medium' | 'large' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Title Alignment */}
            <div className="space-y-2">
              <Label>Title alignment</Label>
              <Select
                value={appearance.titleAlign || 'left'}
                onValueChange={(value) =>
                  onUpdate({ titleAlign: value as 'left' | 'center' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Centre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Divider */}
            <div className="flex items-center justify-between">
              <Label htmlFor="show-divider">Divider below title</Label>
              <Switch
                id="show-divider"
                checked={appearance.showDivider || false}
                onCheckedChange={(checked) => onUpdate({ showDivider: checked })}
              />
            </div>
          </>
        )}
      </div>

      {/* Colour Accents Section */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Colour accent</h3>
          <p className="text-xs text-gray-500 mb-4">Add a subtle colour accent to the block</p>
        </div>

        {/* Accent Color Swatches */}
        <div className="space-y-2">
          <Label>Accent colour</Label>
          <div className="grid grid-cols-4 gap-2">
            {(['none', 'grey', 'blue', 'green', 'yellow', 'red', 'purple'] as const).map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onUpdate({ accent: color })}
                className={cn(
                  "h-10 rounded-md border-2 transition-all",
                  appearance.accent === color
                    ? "border-gray-900 ring-2 ring-gray-300"
                    : "border-gray-200 hover:border-gray-300",
                  color === 'none' && "bg-white",
                  color === 'grey' && "bg-gray-200",
                  color === 'blue' && "bg-blue-200",
                  color === 'green' && "bg-green-200",
                  color === 'yellow' && "bg-yellow-200",
                  color === 'red' && "bg-red-200",
                  color === 'purple' && "bg-purple-200"
                )}
                title={color === 'none' ? 'None' : color.charAt(0).toUpperCase() + color.slice(1)}
              />
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Used for header bar, left border, or highlight background
          </p>
        </div>
      </div>

      {/* Color Field Section - Only for data blocks with table_id */}
      {config.table_id && selectFields.length > 0 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Data Colors</h3>
            <p className="text-xs text-gray-500 mb-4">Use field values to color rows, cards, or events</p>
          </div>

          {/* Color Field */}
          <div className="space-y-2">
            <Label>Color field</Label>
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
                      {getFieldDisplayName(field)}
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
              Use colors from single-select or multi-select field choices. Colors will be applied to rows, cards, or events.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
