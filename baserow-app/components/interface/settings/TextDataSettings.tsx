"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import TextStyle from "@tiptap/extension-text-style"
import Color from "@tiptap/extension-color"
import { Label } from "@/components/ui/label"
import type { BlockConfig } from "@/lib/interface/types"
import { useEffect } from "react"

interface TextDataSettingsProps {
  config: BlockConfig
  tables: any[]
  views: any[]
  fields: any[]
  onUpdate: (updates: Partial<BlockConfig>) => void
  onTableChange: (tableId: string) => Promise<void>
}

export default function TextDataSettings({
  config,
}: TextDataSettingsProps) {
  // Get content from config - support both JSON (TipTap format) and plain text (legacy)
  const contentValue = config?.content || config?.content_json || config?.text_content || config?.text || ""
  
  // Convert content to TipTap JSON format
  const getInitialContent = () => {
    if (contentValue && typeof contentValue === 'object') {
      return contentValue
    }
    
    if (typeof contentValue === 'string' && contentValue.trim() !== '') {
      try {
        const parsed = JSON.parse(contentValue)
        if (parsed && typeof parsed === 'object' && parsed.type === 'doc') {
          return parsed
        }
      } catch {
        // Not JSON, convert plain text to TipTap format
        const lines = contentValue.split('\n').filter(line => line.trim() !== '')
        if (lines.length === 0) {
          return { type: 'doc', content: [] }
        }
        return {
          type: 'doc',
          content: lines.map((line: string) => ({
            type: 'paragraph',
            content: line ? [{ type: 'text', text: line }] : []
          }))
        }
      }
    }
    
    return { type: 'doc', content: [] }
  }

  // Create a read-only editor instance for preview
  const previewEditor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline hover:text-blue-800',
        },
      }),
      TextStyle,
      Color,
    ],
    content: getInitialContent(),
    editable: false, // Always read-only in settings
  })

  // Update preview editor when config changes
  useEffect(() => {
    if (!previewEditor) return
    
    const newContent = getInitialContent()
    const currentContent = previewEditor.getJSON()
    
    // Only update if content actually changed
    if (JSON.stringify(currentContent) !== JSON.stringify(newContent)) {
      previewEditor.commands.setContent(newContent, false)
    }
  }, [contentValue, previewEditor])

  const isEmpty = !previewEditor || previewEditor.isEmpty

  return (
    <div className="space-y-4">
      {/* Info Message */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> Click directly on the text block to edit inline. Use the formatting toolbar for rich text formatting (bold, italic, headings, lists, links).
        </p>
      </div>

      {/* Content Preview - Shows rendered rich text, not raw JSON */}
      <div className="space-y-2">
        <Label>Content Preview</Label>
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-md min-h-[100px] max-h-[300px] overflow-auto">
          {previewEditor ? (
            <div className="prose prose-sm max-w-none">
              {isEmpty ? (
                <span className="text-gray-400 italic">No content yet. Click on the text block to add content.</span>
              ) : (
                <EditorContent editor={previewEditor} />
              )}
            </div>
          ) : (
            <span className="text-gray-400 italic">Loading preview...</span>
          )}
        </div>
        <p className="text-xs text-gray-500">
          This preview shows how your content will appear. Edit directly in the block for a true WYSIWYG experience.
        </p>
      </div>
    </div>
  )
}

