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
  
  // Lifecycle logging
  useEffect(() => {
    console.log(`[Lifecycle] TextBlock MOUNT: blockId=${block.id}`)
    return () => {
      console.log(`[Lifecycle] TextBlock UNMOUNT: blockId=${block.id}`)
    }
  }, [])
  
  // CRITICAL: Read content ONLY from config.content_json
  // No fallbacks, no other sources
  const contentJson = config?.content_json
  
  // Track if config is still loading
  // CRITICAL: Config is loading ONLY if config itself is undefined (not yet loaded)
  // Empty/null content_json is VALID (empty content), not loading state
  const isConfigLoading = config === undefined
  
  // PHASE 2 - TextBlock rehydration audit: Log on render
  if (process.env.NODE_ENV === 'development') {
    console.log(`[TextBlock Rehydration] Block ${block.id}: RENDER`, {
      blockId: block.id,
      rawBlockConfig: config,
      rawContentJson: config?.content_json,
      hasContentJson: !!config?.content_json,
      contentJsonType: typeof config?.content_json,
      isDoc: config?.content_json?.type === 'doc',
      contentLength: config?.content_json?.content?.length || 0,
      isEditing,
      isConfigLoading,
    })
  }
  
  // Track if content_json exists and is valid (for setup state)
  const hasContent = contentJson !== null && 
                     contentJson !== undefined &&
                     typeof contentJson === 'object' && 
                     contentJson.type === 'doc' &&
                     Array.isArray(contentJson.content) &&
                     contentJson.content.length > 0

  // Internal editing state - tracks when user is actively editing text
  // This is separate from isEditing prop (which is page-level edit mode)
  const [isBlockEditing, setIsBlockEditing] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [toolbarPosition, setToolbarPosition] = useState<'top' | 'bottom'>('top')
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedContentRef = useRef<string>("") // Track last saved content to prevent duplicate saves
  
  // Track block.id and config reference to detect when to rehydrate
  const previousBlockIdRef = useRef<string>(block.id)
  const previousConfigRef = useRef<any>(config)
  const editorInitializedRef = useRef<boolean>(false)
  
  // Cache serialized config content_json to avoid repeated JSON.stringify calls
  // This ref is updated only when config.content_json actually changes
  const cachedConfigContentStrRef = useRef<string>("")
  
  // Update cached config content string when config changes
  // This avoids JSON.stringify in hot render paths
  useEffect(() => {
    const currentContentJson = config?.content_json
    if (currentContentJson && typeof currentContentJson === 'object' && currentContentJson.type === 'doc') {
      const newStr = JSON.stringify(currentContentJson)
      // Only update if content actually changed (reference equality check first)
      if (cachedConfigContentStrRef.current !== newStr) {
        cachedConfigContentStrRef.current = newStr
      }
    } else {
      // Empty content
      const emptyContent = { type: 'doc', content: [] }
      const emptyStr = JSON.stringify(emptyContent)
      if (cachedConfigContentStrRef.current !== emptyStr) {
        cachedConfigContentStrRef.current = emptyStr
      }
    }
  }, [config?.content_json])

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
   * Content is initialized from config.content_json and rehydrated when config changes
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
    // Initialize with empty content if config is loading, otherwise use actual content
    // Content will be set via setContent when config loads (handled in useEffect)
    content: isConfigLoading ? { type: 'doc', content: [] } : getInitialContent(),
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
      // Enter block editing mode when editor receives focus
      if (isEditing) {
        setIsBlockEditing(true)
      }
    },
    onBlur: ({ event }) => {
      const relatedTarget = (event as FocusEvent).relatedTarget as HTMLElement
      if (toolbarRef.current && toolbarRef.current.contains(relatedTarget)) {
        return
      }
      
      // Save on blur if content changed
      // CRITICAL: Use cached serialized content for comparison to avoid JSON.stringify in hot path
      if (isEditing && onUpdate && editor) {
        const json = editor.getJSON()
        // Cache serialized content in a ref for comparison
        // This avoids repeated JSON.stringify calls during typing
        const currentJsonStr = JSON.stringify(json)
        
        // Only save if content actually changed
        if (currentJsonStr !== lastSavedContentRef.current) {
          handleSaveContent(json)
        }
      }
      
      blurTimeoutRef.current = setTimeout(() => {
        setIsFocused(false)
        // Exit block editing mode when editor loses focus
        setIsBlockEditing(false)
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
   * Prevents duplicate saves by checking against lastSavedContentRef
   */
  const handleSaveContent = useCallback((json: any) => {
    if (!onUpdate || !editor) return

    const jsonStr = JSON.stringify(json)
    
    // CRITICAL: Only save if content actually changed
    // This prevents duplicate saves when editor rehydrates or updates
    if (jsonStr === lastSavedContentRef.current) {
      setSaveStatus("idle")
      return
    }

    // PHASE 1 - TextBlock write verification: Log before save
    if (process.env.NODE_ENV === 'development') {
      console.log(`[TextBlock Write] Block ${block.id}: BEFORE SAVE`, {
        blockId: block.id,
        contentJson: json,
        contentJsonStr: jsonStr,
        contentJsonType: typeof json,
        isDoc: json?.type === 'doc',
        contentLength: json?.content?.length || 0,
      })
    }

    // Update last saved content reference BEFORE calling onUpdate
    // This prevents race conditions where multiple saves could be triggered
    lastSavedContentRef.current = jsonStr

    // Save ONLY to content_json
    // The parent (InterfaceBuilder) will reload blocks from API after this
    // which will trigger rehydration with fresh config
    onUpdate(block.id, {
      content_json: json, // ONLY field - no other content fields
    })

    setSaveStatus("saved")
    
    // Reset to idle after 2 seconds
    setTimeout(() => {
      setSaveStatus("idle")
    }, 2000)
  }, [block.id, onUpdate, editor])

  /**
   * Rehydrate editor when block.id or block.config reference changes
   * CRITICAL: This ensures editor content matches fresh config from API
   * Treats block.config as immutable - rehydrate on reference change
   * CRITICAL: Only rehydrate when editor is not focused to avoid interrupting typing
   */
  useEffect(() => {
    if (!editor) return
    
    const blockIdChanged = previousBlockIdRef.current !== block.id
    const configReferenceChanged = previousConfigRef.current !== config
    
    // PHASE 2 - TextBlock rehydration audit: Log config changes
    if (process.env.NODE_ENV === 'development') {
      if (blockIdChanged || configReferenceChanged) {
        console.log(`[TextBlock Rehydration] Block ${block.id}: CONFIG CHANGED`, {
          blockId: block.id,
          blockIdChanged,
          configReferenceChanged,
          previousBlockId: previousBlockIdRef.current,
          currentConfig: config,
          currentContentJson: config?.content_json,
          previousConfig: previousConfigRef.current,
          previousContentJson: previousConfigRef.current?.content_json,
          isFocused,
          isBlockEditing,
        })
      }
    }
    
    // Update refs
    previousBlockIdRef.current = block.id
    previousConfigRef.current = config
    
    // If block ID changed, this is a different block - always rehydrate (unless editing)
    if (blockIdChanged) {
      // CRITICAL: Don't rehydrate if user is actively editing this block
      if (isBlockEditing && isFocused) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[TextBlock Rehydration] Block ${block.id}: SKIPPED (user editing)`, {
            blockId: block.id,
            isBlockEditing,
            isFocused
          })
        }
        return
      }
      
      const newContent = getInitialContent()
      
      // PHASE 2 - TextBlock rehydration audit: Log editor initialization
      if (process.env.NODE_ENV === 'development') {
        console.log(`[TextBlock Rehydration] Block ${block.id}: EDITOR INIT (block ID changed)`, {
          blockId: block.id,
          editorInitialContent: newContent,
          configContentJson: config?.content_json,
          matches: JSON.stringify(newContent) === JSON.stringify(config?.content_json),
        })
      }
      
      editor.commands.setContent(newContent, false) // false = don't emit update event
      // Use cached serialized content from config instead of stringifying again
      lastSavedContentRef.current = cachedConfigContentStrRef.current || JSON.stringify(newContent)
      editorInitializedRef.current = true
      return
    }
    
    // If config reference changed (immutable update), rehydrate if content changed
    // CRITICAL: Compare using cached serialized content to avoid JSON.stringify in hot path
    // CRITICAL: Only rehydrate when editor is not focused to avoid interrupting typing
    if (configReferenceChanged) {
      // CRITICAL: Don't rehydrate if user is actively editing
      if (isBlockEditing && isFocused) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[TextBlock Rehydration] Block ${block.id}: SKIPPED (user editing)`, {
            blockId: block.id,
            isBlockEditing,
            isFocused
          })
        }
        return
      }
      
      // Get current editor content once
      const currentContent = editor.getJSON()
      const currentStr = JSON.stringify(currentContent)
      
      // Use cached config content string (updated in separate effect when config changes)
      const newStr = cachedConfigContentStrRef.current
      
      // PHASE 2 - TextBlock rehydration audit: Log rehydration decision
      if (process.env.NODE_ENV === 'development') {
        console.log(`[TextBlock Rehydration] Block ${block.id}: REHYDRATION CHECK`, {
          blockId: block.id,
          currentEditorContent: currentContent,
          currentEditorContentStr: currentStr,
          configContentJson: config?.content_json,
          configContentStr: newStr,
          contentChanged: currentStr !== newStr,
          isFocused,
          isBlockEditing,
          willRehydrate: currentStr !== newStr && !isFocused && !isBlockEditing,
        })
      }
      
      // Only update if content actually changed AND editor is not focused (to avoid interrupting typing)
      if (currentStr !== newStr && !isFocused && !isBlockEditing) {
        const newContent = getInitialContent()
        
        // PHASE 2 - TextBlock rehydration audit: Log actual rehydration
        if (process.env.NODE_ENV === 'development') {
          console.log(`[TextBlock Rehydration] Block ${block.id}: REHYDRATING`, {
            blockId: block.id,
            oldContent: currentContent,
            newContent,
            configContentJson: config?.content_json,
            matches: JSON.stringify(newContent) === JSON.stringify(config?.content_json),
          })
        }
        
        editor.commands.setContent(newContent, false) // false = don't emit update event
        // Update last saved reference to prevent immediate re-save
        lastSavedContentRef.current = newStr
      }
    }
  }, [block.id, config, editor, isFocused, isBlockEditing, getInitialContent])

  /**
   * Initialize editor content and lastSavedContentRef when editor is first created
   * CRITICAL: Use cached serialized content to avoid JSON.stringify
   */
  useEffect(() => {
    if (editor && !editorInitializedRef.current && !isConfigLoading) {
      // PHASE 2 - TextBlock rehydration audit: Log initial editor setup
      if (process.env.NODE_ENV === 'development') {
        const initialContent = editor.getJSON()
        console.log(`[TextBlock Rehydration] Block ${block.id}: INITIAL EDITOR SETUP`, {
          blockId: block.id,
          editorInitialContent: initialContent,
          configContentJson: config?.content_json,
          cachedConfigContentStr: cachedConfigContentStrRef.current,
          matches: JSON.stringify(initialContent) === JSON.stringify(config?.content_json),
        })
      }

      // Use cached config content string if available, otherwise stringify current content
      if (cachedConfigContentStrRef.current) {
        lastSavedContentRef.current = cachedConfigContentStrRef.current
      } else {
        const initialContent = editor.getJSON()
        lastSavedContentRef.current = JSON.stringify(initialContent)
      }
      editorInitializedRef.current = true
    }
  }, [editor, isConfigLoading, block.id, config])
  
  /**
   * Handle config loading state - reinitialize editor when config becomes available
   * CRITICAL: Use cached serialized content to avoid JSON.stringify
   */
  useEffect(() => {
    if (editor && isConfigLoading === false && !editorInitializedRef.current) {
      // Config just finished loading, initialize editor content
      const initialContent = getInitialContent()
      
      // PHASE 2 - TextBlock rehydration audit: Log config load completion
      if (process.env.NODE_ENV === 'development') {
        console.log(`[TextBlock Rehydration] Block ${block.id}: CONFIG LOADED`, {
          blockId: block.id,
          configContentJson: config?.content_json,
          editorInitialContent: initialContent,
          matches: JSON.stringify(initialContent) === JSON.stringify(config?.content_json),
        })
      }
      
      editor.commands.setContent(initialContent, false)
      // Use cached config content string if available
      lastSavedContentRef.current = cachedConfigContentStrRef.current || JSON.stringify(initialContent)
      editorInitializedRef.current = true
    }
  }, [editor, isConfigLoading, getInitialContent, block.id, config])

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

  // Show loading state if config is still loading
  if (isConfigLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center text-gray-400 text-sm p-4" style={blockStyle}>
        <div className="text-center">
          <div className="animate-pulse mb-2">Loading...</div>
          <p className="text-xs text-gray-400">Loading block content</p>
        </div>
      </div>
    )
  }

  // Show loading state if editor is not ready yet
  if (!editor) {
    return (
      <div className="h-full w-full flex items-center justify-center text-gray-400 text-sm p-4" style={blockStyle}>
        <div className="text-center">
          <div className="animate-pulse mb-2">Initializing editor...</div>
          <p className="text-xs text-gray-400">Setting up text editor</p>
        </div>
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

  // Empty state hint: Show when empty and not editing (subtle hint)
  const showEmptyHint = !hasContent && isEditing && !isBlockEditing

  return (
    <div 
      ref={containerRef}
      data-block-editing={isBlockEditing ? "true" : "false"}
      className={cn(
        "h-full w-full overflow-auto flex flex-col relative",
        // Visual editing state: blue ring when actively editing
        isBlockEditing && "ring-2 ring-blue-500 ring-offset-2 rounded-lg",
        // Subtle hover state when not editing
        isEditing && !isBlockEditing && "hover:ring-1 hover:ring-gray-300 rounded-lg transition-all",
        // Prevent dragging/resizing while editing
        isBlockEditing && "pointer-events-auto"
      )}
      style={{
        ...blockStyle,
        minHeight: '100px',
      }}
      // Prevent drag/resize events from propagating when editing
      onMouseDown={(e) => {
        if (isBlockEditing) {
          e.stopPropagation()
        }
      }}
      onClick={(e) => {
        // Only enter edit mode when page is in edit mode
        if (isEditing && !isBlockEditing && editor) {
          const target = e.target as HTMLElement
          // Don't focus if clicking buttons or toolbar
          if (
            !target.closest('button') &&
            !target.closest('[role="button"]') &&
            !target.closest('.drag-handle') &&
            !target.closest('.react-resizable-handle')
          ) {
            setIsBlockEditing(true)
            editor.commands.focus('end')
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
          // Cursor cues: text cursor when editable, pointer when clickable, default when not
          isBlockEditing && "cursor-text",
          isEditing && !isBlockEditing && "cursor-pointer",
          !isEditing && "cursor-default"
        )}
        style={{
          color: appearance.text_color || 'inherit',
        }}
        onClick={(e) => {
          // Only enter edit mode when page is in edit mode
          if (isEditing && !isBlockEditing && editor) {
            e.stopPropagation()
            setIsBlockEditing(true)
            editor.commands.focus('end')
          }
        }}
        onMouseDown={(e) => {
          // Prevent drag/resize when clicking to edit
          if (isBlockEditing) {
            e.stopPropagation()
          }
          if (isEditing && editor && !editor.isFocused) {
            e.stopPropagation()
            setIsBlockEditing(true)
            editor.commands.focus('end')
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
          {/* Use block.id as key to force EditorContent re-render when block changes */}
          <EditorContent key={block.id} editor={editor} />
          {/* Empty state hint - only show when empty and not actively editing */}
          {showEmptyHint && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-sm text-gray-400 italic">Click to add text…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
