"use client"

import { useEffect } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import TextStyle from "@tiptap/extension-text-style"
import Color from "@tiptap/extension-color"
import type { ViewBlock } from "@/types/database"

interface TextBlockProps {
  block: ViewBlock
}

/**
 * TextBlock - Rich text block with TipTap editor for rendering
 * Supports both TipTap JSON format (content_json) and HTML format (content)
 */
export default function TextBlock({ block }: TextBlockProps) {
  const config = block.config || {}
  
  // Support both TipTap JSON format (preferred) and HTML format (legacy)
  const contentJson = config.content_json
  const contentHtml = config.content || ""
  
  // Determine initial content - prefer JSON if available, otherwise use HTML
  const getInitialContent = () => {
    if (contentJson && typeof contentJson === 'object' && contentJson.type === 'doc') {
      return contentJson
    }
    if (contentHtml) {
      return contentHtml
    }
    return { type: 'doc', content: [] }
  }
  
  // Initialize TipTap editor for rendering (read-only)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
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
    editable: false, // Read-only for display
    content: getInitialContent(),
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none w-full',
      },
    },
  })

  // Update editor content when block config changes
  useEffect(() => {
    if (!editor) return
    
    const newContent = getInitialContent()
    editor.commands.setContent(newContent, false)
  }, [editor, contentJson, contentHtml])

  // Show loading state if editor is not ready
  if (!editor) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-sm text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="w-full h-full">
      <div className="prose prose-sm max-w-none w-full">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
