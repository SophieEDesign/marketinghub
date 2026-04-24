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
  const showTitle = appearance.showTitle !== false && (appearance as any).show_title !== false
  const viewType = ((config as any)?.view_type || blockType || "") as string
  const canUseColourByField = (() => {
    // Show only for block/view types that have a visual color-field consumer.
    // Keep legacy compatibility reads in renderers unchanged; this only controls UI visibility.
    const supportedViewTypes = new Set([
      "grid",
      "list",
      "gallery",
      "calendar",
      "kanban",
      "timeline",
    ])
    return supportedViewTypes.has(viewType)
  })()
  
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
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Header</h3>
          <p className="text-xs text-gray-500 mb-4">Control the block title</p>
        </div>

        <div className="space-y-2">
          <Label>Title</Label>
          <Input
            type="text"
            value={titleInputValue}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Block title"
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="show-title">Show title</Label>
          <Switch
            id="show-title"
            checked={showTitle}
            onCheckedChange={(checked) => onUpdate({ showTitle: checked, show_title: checked } as any)}
          />
        </div>

        {showTitle && (
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

      {/* Colour */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Colour</h3>
          <p className="text-xs text-gray-500 mb-4">Colour settings for this block</p>
        </div>

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
      {canUseColourByField && config.table_id && selectFields.length > 0 && (
        <div className="space-y-4">
          {/* Color Field */}
          <div className="space-y-2">
            <Label>Colour by field</Label>
            <div className="relative">
              <Select
                value={appearance.color_field || "__none__"}
                onValueChange={(value) => onUpdate({ color_field: value === "__none__" ? undefined : value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select field..." />
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
              Uses single-select or multi-select options to colour rows, cards, or events.
            </p>
          </div>
        </div>
      )}

      <details className="group rounded-md border border-gray-200 p-3" open={false}>
        <summary className="cursor-pointer list-none text-sm font-semibold text-gray-900">
          Advanced appearance
        </summary>
        <div className="mt-3 space-y-4">
          <div className="space-y-2">
            <Label>Background</Label>
            <Select
              value={appearance.background || 'none'}
              onValueChange={(value) =>
                onUpdate({ background: value as 'none' | 'subtle' | 'tinted' | 'emphasised' })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="subtle">Subtle</SelectItem>
                <SelectItem value="tinted">Tinted</SelectItem>
                <SelectItem value="emphasised">Emphasised</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Border</Label>
            <Select
              value={appearance.border || 'none'}
              onValueChange={(value) =>
                onUpdate({ border: value as 'none' | 'outline' | 'card' })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="outline">Soft outline</SelectItem>
                <SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Corner radius</Label>
            <Select
              value={appearance.radius || 'square'}
              onValueChange={(value) =>
                onUpdate({ radius: value as 'square' | 'rounded' })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="square">Square</SelectItem>
                <SelectItem value="rounded">Rounded</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Shadow</Label>
            <Select
              value={appearance.shadow || 'none'}
              onValueChange={(value) =>
                onUpdate({ shadow: value as 'none' | 'subtle' | 'card' })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="subtle">Subtle</SelectItem>
                <SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Padding</Label>
            <Select
              value={
                typeof appearance.padding === 'string'
                  ? appearance.padding
                  : 'normal'
              }
              onValueChange={(value) =>
                onUpdate({ padding: value as 'compact' | 'normal' | 'spacious' })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">Compact</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="spacious">Spacious</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Margin (top/bottom)</Label>
            <Select
              value={appearance.margin || 'none'}
              onValueChange={(value) =>
                onUpdate({ margin: value as 'none' | 'small' | 'normal' | 'large' })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </details>
    </div>
  )
}
