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
  const imageAlignment = config?.image_alignment || "center"
  const imageWidth = config?.image_width || "auto"
  
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
        <div className="h-full flex items-center justify-center text-gray-400">
          <ImageIcon className="h-8 w-8" />
        </div>
      )
    }

    const alignmentClass = {
      left: "justify-start",
      center: "justify-center",
      right: "justify-end",
    }[imageAlignment] || "justify-center"

    const widthClass = imageWidth === "auto" ? "w-auto max-w-full" : "w-full"

    return (
      <div className={`h-full p-4 flex ${alignmentClass}`} onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={imageAlt || ""}
          className={`${widthClass} max-h-full object-contain rounded-md`}
          onError={(e) => {
            e.currentTarget.style.display = "none"
            const parent = e.currentTarget.parentElement
            if (parent) {
              parent.innerHTML = '<div class="text-gray-400 text-sm">Failed to load image</div>'
            }
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
