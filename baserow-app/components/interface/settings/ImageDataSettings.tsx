"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import type { BlockConfig } from "@/lib/interface/types"

interface ImageDataSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig>) => void
}

export default function ImageDataSettings({
  config,
  onUpdate,
}: ImageDataSettingsProps) {
  return (
    <div className="space-y-4">
      {/* Image URL */}
      <div className="space-y-2">
        <Label>Image URL *</Label>
        <Input
          value={config.image_url || ""}
          onChange={(e) => onUpdate({ image_url: e.target.value })}
          placeholder="https://example.com/image.jpg"
        />
        <p className="text-xs text-gray-500">
          Enter a direct link to an image. Supports: JPG, PNG, GIF, WebP, SVG
        </p>
      </div>

      {/* Alt Text */}
      <div className="space-y-2">
        <Label>Alt Text</Label>
        <Input
          value={config.image_alt || ""}
          onChange={(e) => onUpdate({ image_alt: e.target.value })}
          placeholder="Descriptive text for accessibility"
        />
        <p className="text-xs text-gray-500">
          Describe the image for screen readers and SEO
        </p>
      </div>

      {/* Image Preview */}
      {config.image_url && (
        <div className="space-y-2">
          <Label>Preview</Label>
          <div className="border rounded-lg p-4 bg-gray-50">
            <img
              src={config.image_url}
              alt={config.image_alt || "Image preview"}
              className="max-w-full h-auto rounded"
              onError={(e) => {
                e.currentTarget.style.display = "none"
                const parent = e.currentTarget.parentElement
                if (parent) {
                  const errorDiv = document.createElement("div")
                  errorDiv.className = "text-sm text-red-500"
                  errorDiv.textContent = "Failed to load image"
                  parent.appendChild(errorDiv)
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

