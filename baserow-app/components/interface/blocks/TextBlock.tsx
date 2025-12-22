"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import type { PageBlock } from "@/lib/interface/types"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
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
  const [htmlContent, setHtmlContent] = useState(content)
  const [activeTab, setActiveTab] = useState<"visual" | "html">("visual")

  // Sync content when block changes
  useEffect(() => {
    setEditingContent(content)
    setHtmlContent(content)
  }, [content])

  // Sync HTML content when visual editor changes
  useEffect(() => {
    if (activeTab === "visual") {
      setHtmlContent(editingContent)
    }
  }, [editingContent, activeTab])

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
    setHtmlContent(value)
    // Auto-save on change
    if (onUpdate) {
      onUpdate(value)
    }
  }

  function handleHtmlChange(value: string) {
    setHtmlContent(value)
    setEditingContent(value)
    // Auto-save on change
    if (onUpdate) {
      onUpdate(value)
    }
  }

  if (isEditing) {
    return (
      <div className="h-full flex flex-col">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "visual" | "html")} className="h-full flex flex-col">
          <TabsList className="mb-2">
            <TabsTrigger value="visual">Visual</TabsTrigger>
            <TabsTrigger value="html">HTML</TabsTrigger>
          </TabsList>
          <TabsContent value="visual" className="flex-1 flex flex-col mt-0">
            <ReactQuill
              theme="snow"
              value={editingContent}
              onChange={handleChange}
              modules={quillModules}
              formats={quillFormats}
              placeholder="Enter text content..."
              className="flex-1 flex flex-col"
            />
          </TabsContent>
          <TabsContent value="html" className="flex-1 mt-0">
            <Textarea
              value={htmlContent}
              onChange={(e) => handleHtmlChange(e.target.value)}
              placeholder="Enter HTML content..."
              className="h-full font-mono text-sm resize-none"
            />
          </TabsContent>
        </Tabs>
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
