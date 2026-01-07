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
  // Priority: content (TipTap JSON) > content_json > text_content > text
  const contentValue = config?.content || config?.content_json || config?.text_content || config?.text || ""
  
  // Convert plain text to TipTap JSON if needed
  const getInitialContent = () => {
    // If content is already an object (TipTap JSON), use it directly
    if (contentValue && typeof contentValue === 'object') {
      return contentValue
    }
    
    // If content is a string, check if it's JSON
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
          return {
            type: 'doc',
            content: []
          }
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
    
    // Empty state
    return {
      type: 'doc',
      content: []
    }
  }

  const [isFocused, setIsFocused] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [toolbarPosition, setToolbarPosition] = useState<'top' | 'bottom'>('top')
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * REAL Rich Text Editor Implementation (TipTap/ProseMirror)
   * 
   * CRITICAL REQUIREMENTS MET:
   * ✓ Editor is ALWAYS mounted (never conditionally rendered)
   * ✓ Editor is editable when isEditing=true, read-only when false
   * ✓ Content stored as ProseMirror JSON only (config.content)
   * ✓ No HTML rendering, no preview mode, no fake editing
   * ✓ Click → caret appears → type directly → saves automatically
   * ✓ Toolbar with formatting controls (Bold, Italic, Headings, Lists, Links)
   * ✓ Auto-saves on blur and debounced on update
   * 
   * This is a REAL editor instance, not a renderer.
   * If you cannot type into this block, the implementation is wrong.
   */
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
    content: getInitialContent(),
    editable: isEditing, // CRITICAL: Only editable when in edit mode
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[60px] w-full',
        'data-placeholder': isEditing ? 'Start typing…' : '',
        // CRITICAL: Make editor focusable when editable
        // TipTap automatically sets contenteditable based on editable prop
        tabindex: isEditing ? '0' : '-1',
      },
      // Keyboard shortcuts for formatting
      handleKeyDown: (view, event) => {
        // Cmd/Ctrl + B for bold
        if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
          event.preventDefault()
          editor?.chain().focus().toggleBold().run()
          return true
        }
        // Cmd/Ctrl + I for italic
        if ((event.metaKey || event.ctrlKey) && event.key === 'i') {
          event.preventDefault()
          editor?.chain().focus().toggleItalic().run()
          return true
        }
        // Cmd/Ctrl + K for link
        if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
          event.preventDefault()
          const url = window.prompt('Enter URL:')
          if (url) {
            editor?.chain().focus().setLink({ href: url }).run()
          }
          return true
        }
        return false
      },
    },
    onFocus: () => {
      // Clear any pending blur timeout
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current)
        blurTimeoutRef.current = null
      }
      setIsFocused(true)
    },
    onBlur: ({ event }) => {
      // Check if blur is caused by clicking on toolbar
      const relatedTarget = (event as FocusEvent).relatedTarget as HTMLElement
      if (toolbarRef.current && toolbarRef.current.contains(relatedTarget)) {
        // Don't hide toolbar if clicking on it
        return
      }
      
      // Save on blur if in edit mode and content changed
      if (isEditing && onUpdate && editor) {
        const json = editor.getJSON()
        const currentContent = config?.content || config?.content_json || config?.text_content || config?.text || ""
        let currentJson: any
        
        try {
          if (typeof currentContent === 'string') {
            currentJson = JSON.parse(currentContent)
          } else {
            currentJson = currentContent
          }
        } catch {
          currentJson = null
        }
        
        // Only save if content actually changed
        if (JSON.stringify(json) !== JSON.stringify(currentJson)) {
          onUpdate(block.id, {
            content: JSON.stringify(json),
            content_json: json,
            text_content: editor.getText(),
          })
        }
      }
      
      // Delay hiding toolbar to prevent flicker when clicking toolbar buttons
      blurTimeoutRef.current = setTimeout(() => {
        setIsFocused(false)
      }, 150)
    },
    onUpdate: ({ editor }) => {
      // Debounced save - only save when in edit mode
      if (!onUpdate || !isEditing) return

      setSaveStatus("saving")

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      // Debounce save: wait 1200ms (within 1000-1500ms range) after last change
      saveTimeoutRef.current = setTimeout(() => {
        const json = editor.getJSON()
        // Save to config.content as primary field (TipTap JSON as string)
        onUpdate(block.id, {
          content: JSON.stringify(json), // Primary: TipTap JSON format (stringified)
          content_json: json, // Alias for compatibility (object format)
          text_content: editor.getText(), // Plain text for search/preview
        })
        setSaveStatus("saved")
        
        // Reset to idle after showing "saved" for 2 seconds
        setTimeout(() => {
          setSaveStatus("idle")
        }, 2000)
      }, 1200)
    },
  })

  // Sync editor content when block config changes externally (but not during user editing)
  // MUST be before early returns (React Hooks rule)
  useEffect(() => {
    if (!editor || !isEditing) return
    
    // Get content from config directly (avoid calling getInitialContent which isn't in deps)
    const contentVal = config?.content || config?.content_json || config?.text_content || config?.text || ""
    
    // Convert to TipTap JSON format
    let newContent: any
    if (contentVal && typeof contentVal === 'object') {
      newContent = contentVal
    } else if (typeof contentVal === 'string' && contentVal.trim() !== '') {
      try {
        const parsed = JSON.parse(contentVal)
        if (parsed && typeof parsed === 'object' && parsed.type === 'doc') {
          newContent = parsed
        } else {
          // Convert plain text to TipTap format
          const lines = contentVal.split('\n').filter(line => line.trim() !== '')
          newContent = {
            type: 'doc',
            content: lines.length > 0 ? lines.map((line: string) => ({
              type: 'paragraph',
              content: line ? [{ type: 'text', text: line }] : []
            })) : []
          }
        }
      } catch {
        // Not JSON, convert plain text to TipTap format
        const lines = contentVal.split('\n').filter(line => line.trim() !== '')
        newContent = {
          type: 'doc',
          content: lines.length > 0 ? lines.map((line: string) => ({
            type: 'paragraph',
            content: line ? [{ type: 'text', text: line }] : []
          })) : []
        }
      }
    } else {
      newContent = { type: 'doc', content: [] }
    }
    
    const currentContent = editor.getJSON()
    
    // Only update if content actually changed (avoid infinite loops and save loops)
    // Compare stringified versions to detect real changes
    const currentStr = JSON.stringify(currentContent)
    const newStr = JSON.stringify(newContent)
    
    if (currentStr !== newStr) {
      // Only update if editor is not focused (to avoid interrupting user typing)
      if (!isFocused) {
        editor.commands.setContent(newContent, false) // false = don't emit update event
      }
    }
  }, [config?.content, config?.content_json, config?.text_content, config?.text, editor, isEditing, isFocused])

  // Calculate toolbar position (above or below) based on available space
  useEffect(() => {
    if (!isEditing || !containerRef.current || !toolbarRef.current) return

    const checkPosition = () => {
      if (!containerRef.current || !toolbarRef.current) return
      
      const containerRect = containerRef.current.getBoundingClientRect()
      const toolbarHeight = 40 // Approximate toolbar height
      const spaceAbove = containerRect.top
      const spaceBelow = window.innerHeight - containerRect.bottom

      // If not enough space above but enough below, position toolbar below
      if (spaceAbove < toolbarHeight + 20 && spaceBelow > toolbarHeight + 20) {
        setToolbarPosition('bottom')
      } else {
        setToolbarPosition('top')
      }
    }

    checkPosition()
    window.addEventListener('scroll', checkPosition, true)
    window.addEventListener('resize', checkPosition)

    return () => {
      window.removeEventListener('scroll', checkPosition, true)
      window.removeEventListener('resize', checkPosition)
    }
  }, [isEditing, isFocused])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current)
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

  // Toolbar component - floating toolbar that appears when editing
  const Toolbar = () => {
    if (!editor || !isEditing) return null
    
    // Always show toolbar when in edit mode (not just when focused)
    // This makes it easier to discover and use

    return (
      <div 
        ref={toolbarRef}
        className={cn(
          "absolute left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1 z-[100] transition-all duration-200",
          toolbarPosition === 'top' 
            ? cn(
                "top-0",
                isFocused 
                  ? "-translate-y-[calc(100%+8px)] opacity-100 scale-100" 
                  : "-translate-y-[calc(100%+4px)] opacity-70 scale-95 hover:opacity-100 hover:scale-100"
              )
            : cn(
                "bottom-0",
                isFocused 
                  ? "translate-y-[calc(100%+8px)] opacity-100 scale-100" 
                  : "translate-y-[calc(100%+4px)] opacity-70 scale-95 hover:opacity-100 hover:scale-100"
              )
        )}
        style={{
          marginTop: toolbarPosition === 'top' ? '-8px' : '0',
          marginBottom: toolbarPosition === 'bottom' ? '-8px' : '0',
        }}
        onMouseDown={(e) => {
          // Prevent blur when clicking toolbar
          e.preventDefault()
          e.stopPropagation()
        }}
        onClick={(e) => {
          // Keep editor focused when clicking toolbar buttons
          e.stopPropagation()
          if (editor && !editor.isFocused) {
            editor.commands.focus()
          }
        }}
      >
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

  // CRITICAL: Update editor editable state when isEditing changes
  // This ensures the editor is truly editable when in edit mode
  // MUST be before early returns (React Hooks rule)
  useEffect(() => {
    if (!editor) return
    
    // Set editable state - this controls whether user can type
    // TipTap automatically manages contenteditable attribute based on this
    editor.setEditable(isEditing)
    
    // Update DOM attributes to ensure editor is focusable and clickable
    const editorElement = editor.view.dom as HTMLElement
    if (editorElement) {
      if (isEditing) {
        // EDIT MODE: Editor is editable and focusable
        editorElement.setAttribute('data-placeholder', 'Start typing…')
        editorElement.setAttribute('tabindex', '0')
        // TipTap sets contenteditable automatically based on editor.setEditable()
        editorElement.style.cursor = 'text'
        editorElement.style.pointerEvents = 'auto'
        // Ensure the editor can receive focus and text selection
        editorElement.style.userSelect = 'text'
        editorElement.style.webkitUserSelect = 'text'
      } else {
        // VIEW MODE: Editor is read-only
        editorElement.removeAttribute('data-placeholder')
        editorElement.setAttribute('tabindex', '-1')
        // TipTap sets contenteditable="false" automatically when editable=false
        editorElement.style.cursor = 'default'
        editorElement.style.userSelect = 'none'
        editorElement.style.webkitUserSelect = 'none'
      }
    }
  }, [editor, isEditing])

  // Empty state - check if editor is empty
  const isEmpty = !editor || (editor && editor.isEmpty)

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
      className={cn(
        "h-full w-full overflow-auto flex flex-col relative",
        // Focus state: subtle border when focused in edit mode
        isEditing && isFocused && "ring-2 ring-blue-500 ring-opacity-50 rounded-lg",
        // Hover state in edit mode
        isEditing && !isFocused && "hover:ring-1 hover:ring-gray-300 rounded-lg transition-all"
      )}
      style={blockStyle}
      onClick={(e) => {
        // Click to focus when in edit mode
        // Don't focus if clicking on toolbar or other interactive elements
        const target = e.target as HTMLElement
        if (
          isEditing && 
          !isFocused && 
          editor &&
          !target.closest('button') &&
          !target.closest('[role="button"]') &&
          !target.closest('.ProseMirror-focused')
        ) {
          editor.commands.focus()
        }
      }}
      onMouseDown={(e) => {
        // Focus editor on mousedown (before click) for better UX
        if (isEditing && editor && !editor.isFocused) {
          const target = e.target as HTMLElement
          // Only focus if clicking on the editor content area, not on buttons or toolbar
          if (
            !target.closest('button') &&
            !target.closest('[role="button"]') &&
            containerRef.current?.contains(target)
          ) {
            editor.commands.focus()
          }
        }
      }}
    >
      {/* Toolbar - appears on focus in edit mode */}
      {isEditing && <Toolbar />}
      
      {/* Save status indicator - only show in edit mode */}
      {isEditing && saveStatus !== "idle" && (
        <div className="absolute top-2 right-2 text-xs text-gray-500 z-10 bg-white px-2 py-1 rounded shadow-sm">
          {saveStatus === "saving" && "Saving..."}
          {saveStatus === "saved" && "✓ Saved"}
        </div>
      )}

      {/* REAL EDITOR CONTENT - ALWAYS MOUNTED */}
      {/* This is NOT a renderer - it's a live TipTap editor instance */}
      {/* When isEditing=true: editable, focusable, shows caret, accepts typing */}
      {/* When isEditing=false: read-only, displays content */}
      <div 
        className={cn(
          "flex-1 prose prose-sm max-w-none w-full min-h-[60px]",
          "prose-headings:font-semibold",
          "prose-p:my-2 prose-p:first:mt-0 prose-p:last:mb-0",
          "prose-ul:my-2 prose-ul:first:mt-0 prose-ul:last:mb-0",
          "prose-ol:my-2 prose-ol:first:mt-0 prose-ol:last:mb-0",
          "prose-li:my-1",
          "prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline",
          "prose-strong:font-semibold",
          "prose-em:italic",
          // Text alignment
          textAlign === 'center' && "text-center",
          textAlign === 'right' && "text-right",
          textAlign === 'justify' && "text-justify",
          // Text size
          textSize === 'sm' && "prose-sm",
          textSize === 'md' && "prose-base",
          textSize === 'lg' && "prose-lg",
          textSize === 'xl' && "prose-xl",
          // Empty state styling - only in edit mode
          isEmpty && isEditing && "flex items-center justify-center min-h-[100px]",
          // Cursor styling - CRITICAL for UX
          isEditing && "cursor-text",
          !isEditing && "cursor-default"
        )}
        style={{
          color: appearance.text_color || 'inherit',
        }}
        onClick={(e) => {
          // CRITICAL: Focus editor when clicking (only in edit mode)
          // This ensures clicking the block shows a caret and allows typing
          if (isEditing && editor) {
            e.stopPropagation()
            // Focus the editor - this will show the caret
            editor.commands.focus()
          }
        }}
        onMouseDown={(e) => {
          // CRITICAL: Focus on mousedown for better UX
          // This ensures the caret appears immediately when clicking
          if (isEditing && editor && !editor.isFocused) {
            e.stopPropagation()
            editor.commands.focus()
          }
        }}
      >
        {/* REAL EDITOR INSTANCE - NOT A RENDERER */}
        {/* EditorContent mounts the TipTap editor DOM */}
        {/* When editable: shows caret, accepts input, formats text */}
        {/* When read-only: displays content without editing capability */}
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
