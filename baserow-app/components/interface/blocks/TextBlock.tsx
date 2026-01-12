"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import TextStyle from "@tiptap/extension-text-style"
import Color from "@tiptap/extension-color"
import type { PageBlock } from "@/lib/interface/types"
import { debugLog, debugWarn } from "@/lib/interface/debug-flags"
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
  RemoveFormatting,
  CheckSquare,
  Code,
  ChevronDown
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  
  // CRITICAL: Determine if viewer mode is forced (check URL or parent context)
  // Viewer mode should always force read-only, regardless of isEditing prop
  const isViewer = typeof window !== 'undefined' && window.location.search.includes('view=true')
  const readOnly = isViewer || !isEditing
  
  // Lifecycle logging - SANITY TEST for remount detection
  // If you see MOUNT -> UNMOUNT -> MOUNT on save, that's a remount issue (not TipTap)
  useEffect(() => {
    console.log(`[TextBlock] MOUNT: blockId=${block.id}`)
    return () => {
      console.log(`[TextBlock] UNMOUNT: blockId=${block.id}`)
    }
  }, [])
  
  // Log render mode for debugging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[TextBlock] render mode: blockId=${block.id}`, {
        isViewer,
        isEditing,
        readOnly,
        effectiveIsEditing: !readOnly,
      })
    }
  }, [block.id, isViewer, isEditing, readOnly])
  
  // CRITICAL: Read content ONLY from config.content_json
  // No fallbacks, no other sources
  const contentJson = config?.content_json
  
  // Track if config is still loading
  // CRITICAL: Config is loading ONLY if config itself is undefined (not yet loaded)
  // Empty/null content_json is VALID (empty content), not loading state
  const isConfigLoading = config === undefined
  
  // DEBUG_TEXT: Log on render
  debugLog('TEXT', `Block ${block.id}: RENDER`, {
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
  
  // Track block.id to detect when to rehydrate (only on block ID change)
  const previousBlockIdRef = useRef<string>(block.id)
  const editorInitializedRef = useRef<boolean>(false)
  // CRITICAL: Track if editor has been initialized for this block ID
  // Only set content on first mount, never again unless block ID changes
  const hasInitialised = useRef<boolean>(false)
  
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
   * CRITICAL: Editor is always mounted, editable state changes based on isEditing prop and viewer mode
   * Content is initialized from config.content_json and rehydrated when config changes
   * CRITICAL: Editor must be editable when effectiveIsEditing=true (isEditing=true AND not viewer mode)
   */
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: {
          HTMLAttributes: {
            class: 'code-block',
          },
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
    editable: true, // CRITICAL: Editor must ALWAYS be editable for toolbar commands to work
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[60px] w-full',
        'data-placeholder': isEditing ? 'Start typing…' : '',
        tabindex: isEditing ? '0' : '-1',
        style: config?.appearance?.text_color 
          ? `color: ${config.appearance.text_color};` 
          : '',
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
      // Enter block editing mode when editor receives focus (only if editable)
      if (!readOnly) {
        setIsBlockEditing(true)
        if (process.env.NODE_ENV === 'development') {
          console.log(`[TextBlock] editor init: blockId=${block.id}`, {
            isEditing,
            isViewer,
            readOnly,
            effectiveIsEditing: !readOnly,
          })
        }
      }
    },
    onBlur: ({ event }) => {
      const relatedTarget = (event as FocusEvent).relatedTarget as HTMLElement
      if (toolbarRef.current && toolbarRef.current.contains(relatedTarget)) {
        return
      }
      
      // Save on blur if content changed
      // CRITICAL: Use cached serialized content for comparison to avoid JSON.stringify in hot path
      if (!readOnly && onUpdate && editor) {
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
      // Debounced save - only when in edit mode (not read-only)
      if (!onUpdate || readOnly) return

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
   * CRITICAL: Only set content on first mount or when block ID changes
   * Never call setContent again after initialization unless block ID changes
   * This prevents editor from being reset after saves
   */
  useEffect(() => {
    if (!editor) return
    
    const blockIdChanged = previousBlockIdRef.current !== block.id
    
    // If block ID changed, reset initialization flag and rehydrate
    if (blockIdChanged) {
      previousBlockIdRef.current = block.id
      hasInitialised.current = false
      editorInitializedRef.current = false
      
      const newContent = getInitialContent()
      editor.commands.setContent(newContent, false) // false = don't emit update event
      lastSavedContentRef.current = cachedConfigContentStrRef.current || JSON.stringify(newContent)
      hasInitialised.current = true
      editorInitializedRef.current = true
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[TextBlock] Block ID changed - rehydrated: blockId=${block.id}`)
      }
      return
    }
    
    // Only initialize content on first mount (when hasInitialised is false)
    if (!hasInitialised.current && contentJson) {
      const initialContent = getInitialContent()
      editor.commands.setContent(initialContent, false) // false = don't emit update event
      lastSavedContentRef.current = cachedConfigContentStrRef.current || JSON.stringify(initialContent)
      hasInitialised.current = true
      editorInitializedRef.current = true
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[TextBlock] Initialized content on first mount: blockId=${block.id}`)
      }
    }
  }, [editor, block.id, contentJson, getInitialContent])

  /**
   * Initialize lastSavedContentRef when editor is first created
   * CRITICAL: Only runs once per block ID
   */
  useEffect(() => {
    if (editor && !editorInitializedRef.current && !isConfigLoading) {
      // Use cached config content string if available, otherwise stringify current content
      if (cachedConfigContentStrRef.current) {
        lastSavedContentRef.current = cachedConfigContentStrRef.current
      } else {
        const initialContent = editor.getJSON()
        lastSavedContentRef.current = JSON.stringify(initialContent)
      }
      editorInitializedRef.current = true
    }
  }, [editor, isConfigLoading, block.id])

  // Calculate toolbar position
  useEffect(() => {
    if (!isEditing || readOnly || !containerRef.current) return

    const checkPosition = () => {
      if (!containerRef.current) return
      
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

    // Check position immediately and on changes
    // Use a small delay to ensure DOM is ready
    const timeoutId = setTimeout(checkPosition, 50)
    window.addEventListener('scroll', checkPosition, true)
    window.addEventListener('resize', checkPosition)

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('scroll', checkPosition, true)
      window.removeEventListener('resize', checkPosition)
    }
  }, [isEditing, readOnly])

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

  // Apply appearance settings (declare before useEffect that uses them)
  const appearance = config?.appearance || {}
  const textAlign = appearance.text_align || 'left'
  const textSize = appearance.text_size || 'md'
  const blockStyle: React.CSSProperties = {
    backgroundColor: appearance.background_color,
    borderColor: appearance.border_color,
    borderWidth: appearance.border_width !== undefined ? `${appearance.border_width}px` : undefined,
    borderRadius: appearance.border_radius !== undefined ? `${appearance.border_radius}px` : '8px',
    padding: appearance.padding !== undefined ? `${appearance.padding}px` : '16px',
    // Note: text_color is applied directly to editor element, not container
  }

  // Update editor editable state and appearance when isEditing or appearance changes
  // CRITICAL: Editor editable state must respect both isEditing prop AND viewer mode
  useEffect(() => {
    if (!editor) return
    
    const shouldBeEditable = !readOnly
    editor.setEditable(shouldBeEditable)
    
    if (process.env.NODE_ENV === 'development' && shouldBeEditable && !editorInitializedRef.current) {
      console.log(`[TextBlock] editor init: blockId=${block.id}`, {
        isEditing,
        isViewer,
        readOnly,
        effectiveIsEditing: shouldBeEditable,
      })
    }
    
    const editorElement = editor.view.dom as HTMLElement
    if (editorElement) {
      if (!readOnly) {
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
      
      // Apply text color directly to editor element
      if (appearance.text_color) {
        editorElement.style.color = appearance.text_color
      } else {
        editorElement.style.color = ''
      }
      
      // Apply font weight
      if (appearance.font_weight) {
        const fontWeightMap: Record<string, string> = {
          'normal': '400',
          'medium': '500',
          'semibold': '600',
          'bold': '700'
        }
        editorElement.style.fontWeight = fontWeightMap[appearance.font_weight] || '400'
      } else {
        editorElement.style.fontWeight = ''
      }
      
      // Apply text alignment
      if (textAlign === 'center') {
        editorElement.style.textAlign = 'center'
      } else if (textAlign === 'right') {
        editorElement.style.textAlign = 'right'
      } else if (textAlign === 'justify') {
        editorElement.style.textAlign = 'justify'
      } else {
        editorElement.style.textAlign = 'left'
      }
    }
  }, [editor, readOnly, appearance.text_color, appearance.font_weight, textAlign, block.id, isEditing, isViewer])

  // Toolbar component
  // CRITICAL: Only check for editor existence - visibility controlled by isEditing prop
  const Toolbar = () => {
    if (!editor) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[TextBlock Toolbar] Not rendering: editor not ready')
      }
      return null
    }

    // Toolbar is always visible when in edit mode
    // Position it above or below the block based on available space
    const toolbarOffset = toolbarPosition === 'top' 
      ? "-translate-y-[calc(100%+8px)]" 
      : "translate-y-[calc(100%+8px)]"

    if (process.env.NODE_ENV === 'development') {
      console.log('[TextBlock Toolbar] Rendering:', { 
        blockId: block.id, 
        isEditing, 
        readOnly, 
        toolbarPosition,
        hasEditor: !!editor 
      })
    }

    return (
      <div 
        ref={toolbarRef}
        data-toolbar="true"
        className={cn(
          "absolute left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1 z-[9999] transition-all duration-200 opacity-100",
          toolbarPosition === 'top' ? "top-0" : "bottom-0",
          toolbarOffset
        )}
      style={{
        marginTop: toolbarPosition === 'top' ? '-8px' : '0',
        marginBottom: toolbarPosition === 'bottom' ? '-8px' : '0',
        // Ensure toolbar is always visible
        visibility: 'visible',
        display: 'flex',
      }}
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onMouseEnter={() => {
          // Ensure editor stays focused when hovering toolbar
          if (editor && !editor.isFocused) {
            setIsBlockEditing(true)
            editor.commands.focus()
          }
        }}
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          if (editor && !editor.isFocused) {
            setIsBlockEditing(true)
            editor.commands.focus()
          }
        }}
      >
        {/* Text Type Dropdown */}
        <Select
          value={
            editor.isActive('heading', { level: 1 }) ? 'h1' :
            editor.isActive('heading', { level: 2 }) ? 'h2' :
            editor.isActive('heading', { level: 3 }) ? 'h3' :
            'paragraph'
          }
          onValueChange={(value) => {
            editor.chain().focus().run()
            if (value === 'paragraph') {
              editor.chain().focus().setParagraph().run()
            } else if (value === 'h1') {
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            } else if (value === 'h2') {
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            } else if (value === 'h3') {
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
          }}
        >
          <SelectTrigger 
            className="h-8 px-3 min-w-[100px] text-sm font-medium border-0 shadow-none hover:bg-gray-100 focus:ring-0 bg-transparent"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          >
            <SelectValue className="flex items-center gap-1">
              <span>
                {editor.isActive('heading', { level: 1 }) ? 'Heading 1' :
                 editor.isActive('heading', { level: 2 }) ? 'Heading 2' :
                 editor.isActive('heading', { level: 3 }) ? 'Heading 3' :
                 'Paragraph'}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="z-[10000]">
            <SelectItem value="paragraph">Paragraph</SelectItem>
            <SelectItem value="h1">Heading 1</SelectItem>
            <SelectItem value="h2">Heading 2</SelectItem>
            <SelectItem value="h3">Heading 3</SelectItem>
          </SelectContent>
        </Select>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* List Formatting */}
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            editor.chain().focus().toggleBulletList().run()
          }}
          className={cn("h-8 w-8 p-0", editor.isActive('bulletList') && "bg-gray-100")}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            editor.chain().focus().toggleOrderedList().run()
          }}
          className={cn("h-8 w-8 p-0", editor.isActive('orderedList') && "bg-gray-100")}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            editor.chain().focus().toggleBulletList().run()
          }}
          className={cn("h-8 w-8 p-0", editor.isActive('bulletList') && "bg-gray-100")}
          title="Task List"
        >
          <CheckSquare className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Text Styling */}
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            editor.chain().focus().toggleBold().run()
          }}
          className={cn("h-8 w-8 p-0", editor.isActive('bold') && "bg-gray-100")}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            editor.chain().focus().toggleItalic().run()
          }}
          className={cn("h-8 w-8 p-0", editor.isActive('italic') && "bg-gray-100")}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            editor.chain().focus().toggleStrike().run()
          }}
          className={cn("h-8 w-8 p-0", editor.isActive('strike') && "bg-gray-100")}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            // Toggle code block (for code blocks) or inline code (if text is selected)
            if (editor.isActive('codeBlock')) {
              editor.chain().focus().toggleCodeBlock().run()
            } else if (editor.state.selection.empty) {
              // No selection - toggle code block
              editor.chain().focus().toggleCodeBlock().run()
            } else {
              // Text selected - toggle inline code
              editor.chain().focus().toggleCode().run()
            }
          }}
          className={cn("h-8 w-8 p-0", (editor.isActive('code') || editor.isActive('codeBlock')) && "bg-gray-100")}
          title="Code Block"
        >
          <Code className="h-4 w-4" />
        </Button>
        
        <div className="w-px h-6 bg-gray-300 mx-1" />
        
        {/* Link */}
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
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
        "h-full w-full flex flex-col relative",
        // Visual editing state: blue ring when actively editing
        isBlockEditing && "ring-2 ring-blue-500 ring-offset-2 rounded-lg",
        // Subtle hover state when not editing
        isEditing && !isBlockEditing && "hover:ring-1 hover:ring-gray-300 rounded-lg transition-all",
        // Prevent dragging/resizing while editing
        isBlockEditing && "pointer-events-auto",
        // Allow toolbar to overflow container
        isEditing && "overflow-visible"
      )}
      style={{
        ...blockStyle,
        minHeight: '100px',
        // Ensure toolbar can overflow - critical for toolbar visibility
        overflow: isEditing ? 'visible' : 'auto',
        // Ensure relative positioning for absolute toolbar
        position: 'relative',
      }}
      // Prevent drag/resize events from propagating when editing
      onMouseDown={(e) => {
        if (isBlockEditing) {
          e.stopPropagation()
        }
      }}
        onClick={(e) => {
          // Only enter edit mode when page is in edit mode
          if (isEditing && !readOnly && editor) {
            const target = e.target as HTMLElement
            // Don't focus if clicking buttons or toolbar
            if (
              !target.closest('button') &&
              !target.closest('[role="button"]') &&
              !target.closest('.drag-handle') &&
              !target.closest('.react-resizable-handle') &&
              !target.closest('[data-toolbar]')
            ) {
              e.stopPropagation()
              setIsBlockEditing(true)
              // Small delay to ensure DOM is ready
              setTimeout(() => {
                editor.commands.focus('end')
              }, 10)
            }
          }
        }}
    >
      {/* Toolbar - Always visible when in edit mode (not hover-dependent) */}
      {/* CRITICAL: Toolbar must NOT depend on hover - force it visible for debugging */}
      {editor && isEditing && <Toolbar />}
      
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
          !isEditing && "cursor-default",
          // Read-only mode: disable pointer events but keep editor alive
          readOnly && "pointer-events-none"
        )}
        onClick={(e) => {
          // Only enter edit mode when page is in edit mode
          if (isEditing && !readOnly && !isBlockEditing && editor) {
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
          if (isEditing && !readOnly && editor && !editor.isFocused) {
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
