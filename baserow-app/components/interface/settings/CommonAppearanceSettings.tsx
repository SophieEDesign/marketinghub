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
import { cn } from "@/lib/utils"

interface CommonAppearanceSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig['appearance']>) => void
}

export default function CommonAppearanceSettings({
  config,
  onUpdate,
}: CommonAppearanceSettingsProps) {
  const appearance = config.appearance || {}

  return (
    <div className="space-y-6">
      {/* Container Style Section */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Container Style</h3>
          <p className="text-xs text-gray-500 mb-4">Control how this block appears on the page</p>
        </div>

        {/* Background */}
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
              <SelectItem value="subtle">Subtle (light grey)</SelectItem>
              <SelectItem value="tinted">Tinted (theme colors)</SelectItem>
              <SelectItem value="emphasised">Emphasised (strong color)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Border */}
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

        {/* Corner Radius */}
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

        {/* Shadow */}
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
      </div>

      {/* Spacing Section */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Spacing</h3>
          <p className="text-xs text-gray-500 mb-4">Control spacing inside and around the block</p>
        </div>

        {/* Padding */}
        <div className="space-y-2">
          <Label>Padding</Label>
          <Select
            value={
              typeof appearance.padding === 'string' 
                ? appearance.padding 
                : appearance.padding === undefined 
                ? 'normal' 
                : 'normal' // Default to 'normal' if it's a number (legacy)
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

        {/* Margin */}
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
            value={appearance.title || config.title || ""}
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
    </div>
  )
}
