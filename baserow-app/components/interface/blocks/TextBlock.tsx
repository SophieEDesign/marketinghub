"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import type { PageBlock } from "@/lib/interface/types"
import "react-quill/dist/quill.snow.css"

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import("react-quill"), { ssr: false })

interface TextBlockProps {
  block: PageBlock
  isEditing?: boolean
  onUpdate?: (content: string) => void
}

export default function TextBlock({ block, isEditing = false, onUpdate }: TextBlockProps) {
  const { config } = block
  const content = config?.text_content || ""
  const [editingContent, setEditingContent] = useState(content)

  // Sync content when block changes
  useEffect(() => {
    setEditingContent(content)
  }, [content])

  // Configure Quill toolbar
  const quillModules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ color: [] }, { background: [] }],
      [{ align: [] }],
      ["link"],
      ["clean"],
    ],
  }

  const quillFormats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "list",
    "bullet",
    "color",
    "background",
    "align",
    "link",
  ]

  function handleChange(value: string) {
    setEditingContent(value)
    // Auto-save on change
    if (onUpdate) {
      onUpdate(value)
    }
  }

  if (isEditing) {
    return (
      <div className="h-full flex flex-col">
        <ReactQuill
          theme="snow"
          value={editingContent}
          onChange={handleChange}
          modules={quillModules}
          formats={quillFormats}
          placeholder="Enter text content..."
          className="h-full flex flex-col"
        />
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <div className="prose prose-sm max-w-none">
        {content ? (
          <div dangerouslySetInnerHTML={{ __html: content }} />
        ) : (
          <p className="text-gray-400 italic">Empty text block</p>
        )}
      </div>
    </div>
  )
}
