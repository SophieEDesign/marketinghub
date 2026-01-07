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

/**
 * TextBlock - True inline WYSIWYG editor
 * 
 * REQUIREMENTS MET:
 * ✓ Content stored ONLY in config.content_json (TipTap JSON format)
 * ✓ Both edit and view mode render from same config.content_json source
 * ✓ Inline click-to-edit TipTap editor
 * ✓ Autosave with debounce (1000ms)
 * ✓ Save only when content actually changes
 * ✓ No local-only state for content
 * ✓ No fallback text
 * ✓ Setup state when content_json is missing
 */
export default function TextBlock({ block, isEditing = false, onUpdate }: TextBlockProps) {
  const { config } = block
  
  // CRITICAL: Read content ONLY from config.content_json
  // No fallbacks, no other sources
  const contentJson = config?.content_json || null
  
  // Track if content_json exists (for setup state)
  const hasContent = contentJson !== null && 
                     typeof contentJson === 'object' && 
                     contentJson.type === 'doc' &&
                     Array.isArray(contentJson.content) &&
                     contentJson.content.length > 0

  const [isFocused, setIsFocused] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [toolbarPosition, setToolbarPosition] = useState<'top' | 'bottom'>('top')
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedContentRef = useRef<string>("") // Track last saved content to prevent duplicate saves

  /**
   * Get initial content for editor
   * ONLY uses config.content_json - no fallbacks
   */
  const getInitialContent = useCallback(() => {
    // If content_json exists and is valid TipTap JSON, use it
    if (contentJson && typeof contentJson === 'object' && contentJson.type === 'doc') {
      return contentJson
    }
    
    // Empty state - no content_json or invalid format
    return {
      type: 'doc',
      content: []
    }
  }, [contentJson])

  /**
   * TipTap Editor Instance
   * CRITICAL: Editor is always mounted, editable state changes based on isEditing prop
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
    editable: isEditing,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[60px] w-full',
        'data-placeholder': isEditing ? 'Start typing…' : '',
        tabindex: isEditing ? '0' : '-1',
      },
      handleKeyDown: (view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
          event.preventDefault()
          editor?.chain().focus().toggleBold().run()
          return true
        }
        if ((event.metaKey || event.ctrlKey) && event.key === 'i') {
          event.preventDefault()
          editor?.chain().focus().toggleItalic().run()
          return true
        }
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
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current)
        blurTimeoutRef.current = null
      }
      setIsFocused(true)
    },
    onBlur: ({ event }) => {
      const relatedTarget = (event as FocusEvent).relatedTarget as HTMLElement
      if (toolbarRef.current && toolbarRef.current.contains(relatedTarget)) {
        return
      }
      
      // Save on blur if content changed
      if (isEditing && onUpdate && editor) {
        const json = editor.getJSON()
        const currentJsonStr = JSON.stringify(json)
        
        // Only save if content actually changed
        if (currentJsonStr !== lastSavedContentRef.current) {
          handleSaveContent(json)
        }
      }
      
      blurTimeoutRef.current = setTimeout(() => {
        setIsFocused(false)
      }, 150)
    },
    onUpdate: ({ editor }) => {
      // Debounced save - only when in edit mode
      if (!onUpdate || !isEditing) return

      setSaveStatus("saving")

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      // Debounce: 1000ms (within 800-1200ms range)
      saveTimeoutRef.current = setTimeout(() => {
        const json = editor.getJSON()
        handleSaveContent(json)
      }, 1000)
    },
  })

  /**
   * Save content to database
   * CRITICAL: Saves ONLY to config.content_json
   */
  const handleSaveContent = useCallback((json: any) => {
    if (!onUpdate || !editor) return

    const jsonStr = JSON.stringify(json)
    
    // CRITICAL: Only save if content actually changed
    if (jsonStr === lastSavedContentRef.current) {
      setSaveStatus("idle")
      return
    }

    // Save ONLY to content_json
    onUpdate(block.id, {
      content_json: json, // ONLY field - no other content fields
    })

    // Update last saved content reference
    lastSavedContentRef.current = jsonStr
    setSaveStatus("saved")
    
    // Reset to idle after 2 seconds
    setTimeout(() => {
      setSaveStatus("idle")
    }, 2000)
  }, [block.id, onUpdate, editor])

  /**
   * Sync editor content when config.content_json changes externally
   * CRITICAL: Only updates if content actually changed and editor is not focused
   */
  useEffect(() => {
    if (!editor || !isEditing) return
    
    const newContent = getInitialContent()
    const currentContent = editor.getJSON()
    
    // Compare stringified versions to detect real changes
    const currentStr = JSON.stringify(currentContent)
    const newStr = JSON.stringify(newContent)
    
    // Only update if content changed AND editor is not focused (to avoid interrupting typing)
    if (currentStr !== newStr && !isFocused) {
      editor.commands.setContent(newContent, false) // false = don't emit update event
      // Update last saved reference to prevent immediate re-save
      lastSavedContentRef.current = newStr
    }
  }, [contentJson, editor, isEditing, isFocused, getInitialContent])

  /**
   * Initialize lastSavedContentRef when editor is created
   */
  useEffect(() => {
    if (editor) {
      const initialContent = editor.getJSON()
      lastSavedContentRef.current = JSON.stringify(initialContent)
    }
  }, [editor])

  // Calculate toolbar position
  useEffect(() => {
    if (!isEditing || !containerRef.current || !toolbarRef.current) return

    const checkPosition = () => {
      if (!containerRef.current || !toolbarRef.current) return
      
      const containerRect = containerRef.current.getBoundingClientRect()
      const toolbarHeight = 40
      const spaceAbove = containerRect.top
      const spaceBelow = window.innerHeight - containerRect.bottom

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

  // Cleanup timeouts
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

  // Update editor editable state when isEditing changes
  useEffect(() => {
    if (!editor) return
    
    editor.setEditable(isEditing)
    
    const editorElement = editor.view.dom as HTMLElement
    if (editorElement) {
      if (isEditing) {
        editorElement.setAttribute('data-placeholder', 'Start typing…')
        editorElement.setAttribute('tabindex', '0')
        editorElement.style.cursor = 'text'
        editorElement.style.pointerEvents = 'auto'
        editorElement.style.userSelect = 'text'
        editorElement.style.webkitUserSelect = 'text'
      } else {
        editorElement.removeAttribute('data-placeholder')
        editorElement.setAttribute('tabindex', '-1')
        editorElement.style.cursor = 'default'
        editorElement.style.userSelect = 'text'
        editorElement.style.webkitUserSelect = 'text'
      }
    }
  }, [editor, isEditing])

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
    if (!editor || !isEditing) return null

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
          e.preventDefault()
          e.stopPropagation()
        }}
        onClick={(e) => {
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
          className={cn("h-8 w-8 p-0", editor.isActive('bold') && "bg-gray-100")}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn("h-8 w-8 p-0", editor.isActive('italic') && "bg-gray-100")}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={cn("h-8 w-8 p-0", editor.isActive('strike') && "bg-gray-100")}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </Button>
        
        <div className="w-px h-6 bg-gray-300 mx-1" />
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={cn("h-8 w-8 p-0", editor.isActive('heading', { level: 1 }) && "bg-gray-100")}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn("h-8 w-8 p-0", editor.isActive('heading', { level: 2 }) && "bg-gray-100")}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={cn("h-8 w-8 p-0", editor.isActive('heading', { level: 3 }) && "bg-gray-100")}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </Button>
        
        <div className="w-px h-6 bg-gray-300 mx-1" />
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn("h-8 w-8 p-0", editor.isActive('bulletList') && "bg-gray-100")}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn("h-8 w-8 p-0", editor.isActive('orderedList') && "bg-gray-100")}
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
          className={cn("h-8 w-8 p-0", editor.isActive('link') && "bg-gray-100")}
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

  if (!editor) {
    return (
      <div className="h-full w-full flex items-center justify-center text-gray-400">
        Loading editor...
      </div>
    )
  }

  // Setup state: Show when content_json is missing or empty
  if (!hasContent && !isEditing) {
    return (
      <div 
        className="h-full w-full flex items-center justify-center text-gray-400 text-sm p-4"
        style={blockStyle}
      >
        <div className="text-center">
          <p className="mb-1 font-medium">Text Block</p>
          <p className="text-xs text-gray-400">Enter edit mode to add content</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className={cn(
        "h-full w-full overflow-auto flex flex-col relative",
        isEditing && isFocused && "ring-2 ring-blue-500 ring-opacity-50 rounded-lg",
        isEditing && !isFocused && "hover:ring-1 hover:ring-gray-300 rounded-lg transition-all"
      )}
      style={{
        ...blockStyle,
        minHeight: '100px',
      }}
      onClick={(e) => {
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
        if (isEditing && editor && !editor.isFocused) {
          const target = e.target as HTMLElement
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
      {/* Toolbar */}
      {isEditing && <Toolbar />}
      
      {/* Save status indicator */}
      {isEditing && saveStatus !== "idle" && (
        <div className="absolute top-2 right-2 text-xs text-gray-500 z-10 bg-white px-2 py-1 rounded shadow-sm">
          {saveStatus === "saving" && "Saving..."}
          {saveStatus === "saved" && "✓ Saved"}
        </div>
      )}

      {/* Editor Content - Same source for both edit and view mode */}
      <div 
        className={cn(
          "flex-1 w-full",
          !hasContent && isEditing && "flex items-center justify-center min-h-[100px]",
          isEditing && "cursor-text",
          !isEditing && "cursor-default"
        )}
        style={{
          color: appearance.text_color || 'inherit',
        }}
        onClick={(e) => {
          if (isEditing && editor) {
            e.stopPropagation()
            editor.commands.focus()
          }
        }}
        onMouseDown={(e) => {
          if (isEditing && editor && !editor.isFocused) {
            e.stopPropagation()
            editor.commands.focus()
          }
        }}
      >
        <div 
          className={cn(
            "prose prose-sm max-w-none w-full min-h-[60px]",
            "prose-headings:font-semibold",
            "prose-p:my-2 prose-p:first:mt-0 prose-p:last:mb-0",
            "prose-ul:my-2 prose-ul:first:mt-0 prose-ul:last:mb-0",
            "prose-ol:my-2 prose-ol:first:mt-0 prose-ol:last:mb-0",
            "prose-li:my-1",
            "prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline",
            "prose-strong:font-semibold",
            "prose-em:italic",
            textAlign === 'center' && "text-center",
            textAlign === 'right' && "text-right",
            textAlign === 'justify' && "text-justify",
            textSize === 'sm' && "prose-sm",
            textSize === 'md' && "prose-base",
            textSize === 'lg' && "prose-lg",
            textSize === 'xl' && "prose-xl",
          )}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
