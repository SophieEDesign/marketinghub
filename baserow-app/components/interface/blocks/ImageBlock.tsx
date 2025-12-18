"use client"

import { useState } from "react"
import type { PageBlock } from "@/lib/interface/types"
import { Image as ImageIcon } from "lucide-react"

interface ImageBlockProps {
  block: PageBlock
  isEditing?: boolean
  onUpdate?: (url: string, alt: string) => void
}

export default function ImageBlock({ block, isEditing = false, onUpdate }: ImageBlockProps) {
  const { config } = block
  const imageUrl = config?.image_url || ""
  const imageAlt = config?.image_alt || ""
  const [url, setUrl] = useState(imageUrl)
  const [alt, setAlt] = useState(imageAlt)

  function handleBlur() {
    if (onUpdate && (url !== imageUrl || alt !== imageAlt)) {
      onUpdate(url, alt)
    }
  }

  if (isEditing) {
    return (
      <div className="h-full p-4 space-y-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={handleBlur}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          placeholder="Image URL"
        />
        <input
          type="text"
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          onBlur={handleBlur}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          placeholder="Alt text"
        />
        {url && (
          <div className="mt-2">
            <img
              src={url}
              alt={alt}
              className="max-w-full h-auto rounded-md"
              onError={(e) => {
                e.currentTarget.style.display = "none"
              }}
            />
          </div>
        )}
      </div>
    )
  }

  if (!imageUrl) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <ImageIcon className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="h-full p-4 flex items-center justify-center">
      <img
        src={imageUrl}
        alt={imageAlt}
        className="max-w-full max-h-full object-contain rounded-md"
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
