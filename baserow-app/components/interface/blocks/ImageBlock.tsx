"use client"

import { useState, useRef } from "react"
import type { PageBlock } from "@/lib/interface/types"
import { Image as ImageIcon, Upload } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ImageBlockProps {
  block: PageBlock
  isEditing?: boolean
  onUpdate?: (config: { image_url?: string; image_alt?: string; image_alignment?: string; image_width?: string }) => void
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export default function ImageBlock({ block, isEditing = false, onUpdate }: ImageBlockProps) {
  const { config } = block
  const imageUrl = config?.image_url || ""
  const imageAlt = config?.image_alt || ""
  
  // Support both old format (image_alignment, image_width) and new format (appearance.image_align, appearance.image_size)
  const appearance = config?.appearance || {}
  const imageAlignment = config?.image_alignment || appearance?.image_align || "center"
  const imageSize = config?.image_width || appearance?.image_size || "auto"
  const maxWidth = appearance?.max_width
  
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return

    setUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() || 'jpg'
      const filePath = `interface-images/${generateUUID()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file, { upsert: false })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        alert('Failed to upload image. Please try again.')
        return
      }

      const { data: urlData } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath)

      if (onUpdate) {
        onUpdate({ image_url: urlData.publicUrl })
      }
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('Failed to upload image. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  function handleConfigChange(updates: { image_url?: string; image_alt?: string; image_alignment?: string; image_width?: string }) {
    if (onUpdate) {
      onUpdate(updates)
    }
  }

  // In view mode, render clean image
  if (!isEditing) {
    if (!imageUrl) {
      return (
        <div className="h-full w-full flex items-center justify-center text-gray-400 min-h-[100px]">
          <div className="text-center">
            <ImageIcon className="h-8 w-8 mx-auto mb-2" />
            <p className="text-xs">No image configured</p>
          </div>
        </div>
      )
    }

    const alignmentClass: Record<string, string> = {
      left: "justify-start",
      center: "justify-center",
      right: "justify-end",
    }
    const alignment = alignmentClass[imageAlignment as string] || "justify-center"

    // Determine width class based on image size setting
    let widthClass = "w-auto max-w-full"
    if (imageSize === "full" || imageSize === "w-full") {
      widthClass = "w-full"
    } else if (imageSize === "small") {
      widthClass = "w-auto max-w-[200px]"
    } else if (imageSize === "medium") {
      widthClass = "w-auto max-w-[400px]"
    } else if (imageSize === "large") {
      widthClass = "w-auto max-w-[600px]"
    }

    // Determine object-fit based on image size setting
    const objectFit = imageSize === "cover" ? "object-cover" : "object-contain"

    // Apply max width if specified
    const maxWidthStyle = maxWidth ? { maxWidth: `${maxWidth}px` } : {}

    return (
      <div className={`h-full w-full p-4 flex items-center ${alignment} min-h-[100px]`} onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={imageAlt || ""}
          className={`${widthClass} max-h-full ${objectFit} rounded-md`}
          style={maxWidthStyle}
          onError={(e) => {
            const img = e.currentTarget
            img.style.display = "none"
            const parent = img.parentElement
            if (parent) {
              const errorDiv = document.createElement("div")
              errorDiv.className = "text-gray-400 text-sm text-center"
              errorDiv.innerHTML = `
                <div class="mb-2">
                  <svg class="h-8 w-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>Failed to load image</div>
                <div class="text-xs mt-1">URL: ${imageUrl.substring(0, 50)}${imageUrl.length > 50 ? '...' : ''}</div>
              `
              parent.appendChild(errorDiv)
            }
          }}
          onLoad={() => {
            // Image loaded successfully
            console.log('Image loaded successfully:', imageUrl)
          }}
        />
      </div>
    )
  }

  // In edit mode, show placeholder - settings are in SettingsPanel
  return (
    <div className="h-full flex items-center justify-center text-gray-400" onClick={(e) => e.stopPropagation()}>
      {imageUrl ? (
        <div className="text-center">
          <ImageIcon className="h-8 w-8 mx-auto mb-2" />
          <p className="text-xs">Image configured</p>
          <p className="text-xs text-gray-500">Click settings to edit</p>
        </div>
      ) : (
        <div className="text-center">
          <ImageIcon className="h-8 w-8 mx-auto mb-2" />
          <p className="text-xs">No image</p>
          <p className="text-xs text-gray-500">Click settings to upload</p>
        </div>
      )}
    </div>
  )
}
