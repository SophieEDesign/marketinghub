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
    // Auto-save on change (debounced by ReactQuill internally)
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
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        />
        <style jsx global>{`
          .ql-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            font-size: 14px;
          }
          .ql-editor {
            flex: 1;
            min-height: 200px;
          }
          .ql-toolbar {
            border-top: 1px solid #e5e7eb;
            border-left: 1px solid #e5e7eb;
            border-right: 1px solid #e5e7eb;
            border-bottom: none;
            border-radius: 0.375rem 0.375rem 0 0;
          }
          .ql-container {
            border-bottom: 1px solid #e5e7eb;
            border-left: 1px solid #e5e7eb;
            border-right: 1px solid #e5e7eb;
            border-top: none;
            border-radius: 0 0 0.375rem 0.375rem;
          }
          .ql-editor.ql-blank::before {
            color: #9ca3af;
            font-style: normal;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="h-full p-4 overflow-auto">
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
