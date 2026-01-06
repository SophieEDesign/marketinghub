"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import TextStyle from "@tiptap/extension-text-style"
import Color from "@tiptap/extension-color"
import type { PageBlock } from "@/lib/interface/types"
import { 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link as LinkIcon,
  RemoveFormatting
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface TextBlockProps {
  block: PageBlock
  isEditing?: boolean
  onUpdate?: (blockId: string, config: Partial<PageBlock["config"]>) => void
}

export default function TextBlock({ block, isEditing = false, onUpdate }: TextBlockProps) {
  const { config } = block
  
  // Get content from config - support both JSON (TipTap format) and plain text (legacy)
  const contentValue = config?.content_json || config?.content || config?.text_content || config?.text || ""
  
  // Convert plain text to TipTap JSON if needed
  const getInitialContent = () => {
    if (typeof contentValue === 'string' && contentValue.trim() !== '') {
      // Check if it's already JSON
      try {
        const parsed = JSON.parse(contentValue)
        if (parsed && typeof parsed === 'object') {
          return parsed
        }
      } catch {
        // Not JSON, convert plain text to TipTap format
        return {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: contentValue.split('\n').map((line: string) => ({
                type: 'text',
                text: line
              }))
            }
          ]
        }
      }
    }
    // Empty or already JSON
    return contentValue || {
      type: 'doc',
      content: []
    }
  }

  const [isFocused, setIsFocused] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Initialize TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable default heading levels, we'll use custom ones
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
    content: getInitialContent(),
    editable: isEditing,
    onFocus: () => {
      setIsFocused(true)
    },
    onBlur: () => {
      setIsFocused(false)
    },
    onUpdate: ({ editor }) => {
      // Debounced save
      if (!onUpdate) return

      setSaveStatus("saving")

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      // Debounce save: wait 600ms after last change
      saveTimeoutRef.current = setTimeout(() => {
        const json = editor.getJSON()
        onUpdate(block.id, {
          content_json: json,
          content: editor.getText(), // Also save plain text for compatibility
          text_content: editor.getText(), // Legacy field
        })
        setSaveStatus("saved")
        
        // Reset to idle after showing "saved" for 2 seconds
        setTimeout(() => {
          setSaveStatus("idle")
        }, 2000)
      }, 600)
    },
  })

  // Sync editor content when block config changes externally
  useEffect(() => {
    if (!editor) return
    
    const newContent = getInitialContent()
    const currentContent = editor.getJSON()
    
    // Only update if content actually changed (avoid infinite loops)
    if (JSON.stringify(currentContent) !== JSON.stringify(newContent)) {
      editor.commands.setContent(newContent, false) // false = don't emit update event
    }
  }, [contentValue, editor])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Apply appearance settings
  const appearance = config?.appearance || {}
  const blockStyle: React.CSSProperties = {
    backgroundColor: appearance.background_color,
    borderColor: appearance.border_color,
    borderWidth: appearance.border_width !== undefined ? `${appearance.border_width}px` : undefined,
    borderRadius: appearance.border_radius !== undefined ? `${appearance.border_radius}px` : '8px',
    padding: appearance.padding !== undefined ? `${appearance.padding}px` : '16px',
    color: appearance.text_color,
  }

  const textAlign = appearance.text_align || 'left'
  const textSize = appearance.text_size || 'md'

  // Toolbar component
  const Toolbar = () => {
    if (!editor || !isEditing || !isFocused) return null

    return (
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full mb-2 flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1 z-50">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn(
            "h-8 w-8 p-0",
            editor.isActive('bold') && "bg-gray-100"
          )}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn(
            "h-8 w-8 p-0",
            editor.isActive('italic') && "bg-gray-100"
          )}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={cn(
            "h-8 w-8 p-0",
            editor.isActive('strike') && "bg-gray-100"
          )}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </Button>
        
        <div className="w-px h-6 bg-gray-300 mx-1" />
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={cn(
            "h-8 w-8 p-0",
            editor.isActive('heading', { level: 1 }) && "bg-gray-100"
          )}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn(
            "h-8 w-8 p-0",
            editor.isActive('heading', { level: 2 }) && "bg-gray-100"
          )}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={cn(
            "h-8 w-8 p-0",
            editor.isActive('heading', { level: 3 }) && "bg-gray-100"
          )}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </Button>
        
        <div className="w-px h-6 bg-gray-300 mx-1" />
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(
            "h-8 w-8 p-0",
            editor.isActive('bulletList') && "bg-gray-100"
          )}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(
            "h-8 w-8 p-0",
            editor.isActive('orderedList') && "bg-gray-100"
          )}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        
        <div className="w-px h-6 bg-gray-300 mx-1" />
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const url = window.prompt('Enter URL:')
            if (url) {
              editor.chain().focus().setLink({ href: url }).run()
            }
          }}
          className={cn(
            "h-8 w-8 p-0",
            editor.isActive('link') && "bg-gray-100"
          )}
          title="Add Link"
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().unsetLink().run()}
          disabled={!editor.isActive('link')}
          title="Remove Link"
        >
          <RemoveFormatting className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  // Empty state
  const isEmpty = !editor || editor.isEmpty

  if (!editor) {
    return (
      <div className="h-full w-full flex items-center justify-center text-gray-400">
        Loading editor...
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className="h-full w-full overflow-auto flex flex-col relative"
      style={blockStyle}
      onClick={() => {
        if (isEditing && !isFocused) {
          editor.commands.focus()
        }
      }}
    >
      {/* Toolbar - appears on focus */}
      <Toolbar />
      
      {/* Save status indicator */}
      {isEditing && saveStatus !== "idle" && (
        <div className="absolute top-2 right-2 text-xs text-gray-500 z-10">
          {saveStatus === "saving" && "Saving..."}
          {saveStatus === "saved" && "✓ Saved"}
        </div>
      )}

      {/* Editor content */}
      <div 
        className={cn(
          "flex-1 prose prose-sm max-w-none",
          "prose-headings:font-semibold",
          "prose-p:my-2",
          "prose-ul:my-2",
          "prose-ol:my-2",
          "prose-li:my-1",
          "prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline",
          textAlign === 'center' && "text-center",
          textAlign === 'right' && "text-right",
          textAlign === 'justify' && "text-justify",
          textSize === 'sm' && "prose-sm",
          textSize === 'md' && "prose-base",
          textSize === 'lg' && "prose-lg",
          textSize === 'xl' && "prose-xl",
          // Empty state styling
          isEmpty && isEditing && "flex items-center justify-center min-h-[200px]"
        )}
        style={{
          color: appearance.text_color || 'inherit',
        }}
      >
        {isEmpty && isEditing ? (
          <div className="text-gray-400 text-sm cursor-text">
            Click to start writing...
          </div>
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>
    </div>
  )
}
