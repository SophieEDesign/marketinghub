"use client"

import { useState } from "react"
import type { PageBlock } from "@/lib/interface/types"

interface TextBlockProps {
  block: PageBlock
  isEditing?: boolean
  onUpdate?: (content: string) => void
}

export default function TextBlock({ block, isEditing = false, onUpdate }: TextBlockProps) {
  const { config } = block
  const content = config?.text_content || ""
  const [editingContent, setEditingContent] = useState(content)

  function handleBlur() {
    if (onUpdate && editingContent !== content) {
      onUpdate(editingContent)
    }
  }

  if (isEditing) {
    return (
      <div className="h-full p-4">
        <textarea
          value={editingContent}
          onChange={(e) => setEditingContent(e.target.value)}
          onBlur={handleBlur}
          className="w-full h-full border border-gray-300 rounded-md p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter text content..."
        />
      </div>
    )
  }

  return (
    <div className="h-full p-4 overflow-auto">
      <div className="prose prose-sm max-w-none">
        {content ? (
          <div dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, "<br />") }} />
        ) : (
          <p className="text-gray-400 italic">Empty text block</p>
        )}
      </div>
    </div>
  )
}
