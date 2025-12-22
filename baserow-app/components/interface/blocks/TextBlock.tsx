"use client"

import { useState, useEffect, useRef, useCallback } from "react"
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
  
  // Use refs for uncontrolled editor state to prevent re-renders
  const quillRef = useRef<any>(null)
  const quillEditorRef = useRef<any>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedContentRef = useRef<string>(content)
  
  const [activeTab, setActiveTab] = useState<"visual" | "html">("visual")
  // Local state for editor content - only syncs from prop when content changes externally
  const [editorContent, setEditorContent] = useState<string>(content)

  // Update editor content only when block content changes from external source (not from user typing)
  useEffect(() => {
    // Only update if content changed externally (not from our own save)
    if (content !== lastSavedContentRef.current) {
      setEditorContent(content)
      lastSavedContentRef.current = content
    }
  }, [content])

  // Debounced save function - saves after user stops typing
  const debouncedSave = useCallback((value: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      if (onUpdate && value !== lastSavedContentRef.current) {
        lastSavedContentRef.current = value
        onUpdate(value)
      }
    }, 600) // 600ms debounce
  }, [onUpdate])

  // Save on blur (immediate) - use current editorContent state
  const handleBlur = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    
    // Use current editorContent state (always in sync with what user sees)
    if (onUpdate && editorContent !== lastSavedContentRef.current) {
      lastSavedContentRef.current = editorContent
      onUpdate(editorContent)
    }
  }, [onUpdate, editorContent])

  // Get Quill editor instance callback
  const handleQuillRef = useCallback((quill: any) => {
    quillRef.current = quill
    if (quill) {
      quillEditorRef.current = quill.getEditor()
    }
  }, [])

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

  // Handle Quill change - update local state immediately, debounce save
  function handleQuillChange(value: string) {
    // Update local state immediately for responsive UI (no cursor jump)
    setEditorContent(value)
    // Debounce save to avoid excessive API calls
    debouncedSave(value)
  }

  // Handle HTML textarea change - update local state immediately, debounce save
  function handleHtmlChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value
    // Update local state immediately for responsive UI
    setEditorContent(value)
    // Debounce save to avoid excessive API calls
    debouncedSave(value)
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  if (isEditing) {
    return (
      <div className="h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "visual" | "html")} className="h-full flex flex-col">
          <TabsList className="mb-2">
            <TabsTrigger value="visual">Visual</TabsTrigger>
            <TabsTrigger value="html">HTML</TabsTrigger>
          </TabsList>
          <TabsContent value="visual" className="flex-1 flex flex-col mt-0">
            <ReactQuill
              theme="snow"
              value={editorContent}
              onChange={handleQuillChange}
              onBlur={handleBlur}
              modules={quillModules}
              formats={quillFormats}
              placeholder="Enter text content..."
              className="flex-1 flex flex-col"
            />
          </TabsContent>
          <TabsContent value="html" className="flex-1 mt-0">
            <Textarea
              ref={textareaRef}
              value={editorContent}
              onChange={handleHtmlChange}
              onBlur={handleBlur}
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
      <div className="text-block-content max-w-none">
        {content ? (
          <div dangerouslySetInnerHTML={{ __html: content }} />
        ) : (
          <p className="text-gray-400 italic">Empty text block</p>
        )}
      </div>
    </div>
  )
}
