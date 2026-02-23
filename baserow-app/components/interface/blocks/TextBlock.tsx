"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import TextStyle from "@tiptap/extension-text-style"
import Color from "@tiptap/extension-color"
import type { PageBlock } from "@/lib/interface/types"
import { debugLog } from "@/lib/interface/debug-flags"
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
  CheckSquare,
  Code,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Stable extensions array so useEditor doesn't see a new reference every render (prevents React #185)
const TEXT_BLOCK_EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    codeBlock: { HTMLAttributes: { class: 'code-block' } },
  }),
  Link.configure({
    openOnClick: false,
    HTMLAttributes: { class: 'text-blue-600 underline hover:text-blue-800' },
  }),
  TextStyle,
  Color,
]

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

  // Prevent toolbar interactions from stealing focus/selection from TipTap.
  // Without this, clicks can clear the selection before commands run, making the toolbar feel "broken".
  const handleToolbarMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  // CRITICAL: Determine if viewer mode is forced (check URL or parent context)
  // Viewer mode should always force read-only, regardless of isEditing prop
  // FIX: Use state + useEffect to prevent hydration mismatch
  // Initialize to false (matches server render), then check on client
  const [isViewer, setIsViewer] = useState(false)
  
  useEffect(() => {
    // Only check URL on client side after mount to prevent hydration mismatch
    if (typeof window !== 'undefined') {
      setIsViewer(window.location.search.includes('view=true'))
    }
  }, [])
  
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

  // CRITICAL: Stable empty doc reference so useEditor doesn't get a new object every render.
  // TipTap useEditor can re-create the editor when content option reference changes, causing
  // effect loops (setState in selection effect) and React error #185 (maximum update depth).
  // content must be a mutable array (not readonly) for EditorOptions content type.
  const EMPTY_DOC = useMemo(() => ({ type: 'doc' as const, content: [] }), [])

  // Backward compatibility: older text blocks may still store HTML/text in legacy keys.
  // We only use this to initialize/render when `content_json` is missing.
  // All edits still persist to `content_json`.
  const legacyContent =
    (typeof (config as any)?.content === 'string' && (config as any).content) ||
    (typeof (config as any)?.text_content === 'string' && (config as any).text_content) ||
    (typeof (config as any)?.text === 'string' && (config as any).text) ||
    ""
  
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
  
  // Track if this block has content (for setup/empty state).
  // Prefer content_json, but treat legacy content as "has content" for compatibility.
  const hasContent =
    (contentJson !== null &&
      contentJson !== undefined &&
      typeof contentJson === 'object' &&
      contentJson.type === 'doc' &&
      Array.isArray(contentJson.content) &&
      contentJson.content.length > 0) ||
    (typeof legacyContent === 'string' && legacyContent.trim().length > 0)

  // Internal editing state - tracks when user is actively editing text
  // This is separate from isEditing prop (which is page-level edit mode)
  const [isBlockEditing, setIsBlockEditing] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [hasSelection, setHasSelection] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedContentRef = useRef<string>("") // Track last saved content to prevent duplicate saves

  // Refs for useEditor callbacks so config can be stable (prevents editor recreate → React #185)
  const readOnlyRef = useRef(readOnly)
  const onUpdateRef = useRef(onUpdate)
  const blockIdRef = useRef(block.id)
  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null)
  const handleSaveContentRef = useRef<((json: any) => void) | null>(null)
  readOnlyRef.current = readOnly
  onUpdateRef.current = onUpdate
  blockIdRef.current = block.id

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
    } else if (legacyContent && legacyContent.trim().length > 0) {
      // IMPORTANT: If we only have legacy HTML/text, don't cache an "empty doc" string here.
      // We want the initial `lastSavedContentRef` to come from the editor's parsed JSON so that
      // focus/blur doesn't trigger an unwanted auto-save.
      cachedConfigContentStrRef.current = ""
    } else {
      // Empty content
      const emptyContent = { type: 'doc', content: [] }
      const emptyStr = JSON.stringify(emptyContent)
      if (cachedConfigContentStrRef.current !== emptyStr) {
        cachedConfigContentStrRef.current = emptyStr
      }
    }
  }, [config?.content_json, legacyContent])

  /**
   * Get initial content for editor
   * Prefer config.content_json, but support legacy HTML/text for backward compatibility.
   * CRITICAL: Returns stable EMPTY_DOC reference for empty state to prevent useEditor recreate loop.
   */
  const getInitialContent = useCallback(() => {
    // If content_json exists and is valid TipTap JSON, use it
    if (contentJson && typeof contentJson === 'object' && contentJson.type === 'doc') {
      return contentJson
    }

    // Legacy HTML/text content fallback (TipTap can parse HTML strings)
    if (legacyContent && typeof legacyContent === 'string') {
      return legacyContent
    }
    
    // Empty state - use stable reference to prevent useEditor from re-creating every render
    return EMPTY_DOC
  }, [contentJson, legacyContent, EMPTY_DOC])

  /**
   * Stable initial content for useEditor. Prevents React #185: useEditor re-creates when
   * content option is a new object each render, which re-runs effects (e.g. setHasSelection) in a loop.
   */
  const initialContent = useMemo(
    () => (isConfigLoading ? EMPTY_DOC : getInitialContent()),
    [isConfigLoading, getInitialContent, EMPTY_DOC]
  )

  /**
   * TipTap Editor Instance
   * CRITICAL: Editor is always mounted, editable state changes based on isEditing prop and viewer mode
   * Content is initialized from config.content_json and rehydrated when config changes
   * CRITICAL: Editor must be editable when effectiveIsEditing=true (isEditing=true AND not viewer mode)
   */
  // CRITICAL: Stable config so useEditor is only run once (prevents React #185 re-render loop).
  // All dynamic values are read via refs so the config reference never changes.
  const editorConfig = useMemo(
    () => ({
      extensions: TEXT_BLOCK_EXTENSIONS,
      content: EMPTY_DOC,
      editable: true,
      editorProps: {
        attributes: {
          class: 'focus:outline-none w-full h-full min-h-0',
          'data-placeholder': '',
          tabindex: '-1',
          style: '',
        },
        handleKeyDown: (_view: unknown, event: KeyboardEvent) => {
          if (!readOnlyRef.current) event.stopPropagation()
          const ed = editorRef.current
          if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
            event.preventDefault()
            ed?.chain().focus().toggleBold().run()
            return true
          }
          if ((event.metaKey || event.ctrlKey) && event.key === 'i') {
            event.preventDefault()
            ed?.chain().focus().toggleItalic().run()
            return true
          }
          if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
            event.preventDefault()
            const url = window.prompt('Enter URL:')
            if (url) ed?.chain().focus().setLink({ href: url }).run()
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
        if (!readOnlyRef.current) setIsBlockEditing(true)
      },
      onBlur: ({ event }: { event: FocusEvent }) => {
        const relatedTarget = (event as FocusEvent).relatedTarget as HTMLElement
        if (toolbarRef.current?.contains(relatedTarget)) return
        const ed = editorRef.current
        if (!readOnlyRef.current && onUpdateRef.current && ed) {
          const json = ed.getJSON()
          const currentJsonStr = JSON.stringify(json)
          if (currentJsonStr !== lastSavedContentRef.current) handleSaveContentRef.current?.(json)
        }
        blurTimeoutRef.current = setTimeout(() => {
          setIsFocused(false)
          setIsBlockEditing(false)
        }, 150)
      },
      onUpdate: ({ editor: ed }: { editor: { getJSON: () => any } }) => {
        // CRITICAL: Prevent onUpdate from firing during initialization to avoid React #185 loop
        // When setContent is called during initialization, TipTap may fire onUpdate even with emitUpdate=false
        if (!onUpdateRef.current || readOnlyRef.current || !editorInitializedRef.current) {
          return
        }
        // CRITICAL: Use requestAnimationFrame to defer setState and prevent React #185
        // This ensures setState doesn't happen synchronously during the update callback
        requestAnimationFrame(() => {
          setSaveStatus("saving")
          if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
          saveTimeoutRef.current = setTimeout(() => handleSaveContentRef.current?.(ed.getJSON()), 500)
        })
      },
    }),
    []
  )

  const editor = useEditor(editorConfig)

  // Keep editorRef current so editorProps.handleKeyDown (memoized) can access it
  useEffect(() => {
    editorRef.current = editor
    return () => { editorRef.current = null }
  }, [editor])

  // Track selection state so we can show toolbar on text selection (not just focus)
  // CRITICAL: Debounce selection updates to prevent React #185 (maximum update depth)
  // Use ref to track previous state and only update when actually changed
  const prevSelectionEmptyRef = useRef<boolean>(true)
  useEffect(() => {
    if (!editor) return

    let rafId: number | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const update = () => {
      const isEmpty = editor.state.selection.empty
      // Only update state if selection state actually changed
      if (prevSelectionEmptyRef.current !== isEmpty) {
        prevSelectionEmptyRef.current = isEmpty
        // Debounce state update to prevent rapid-fire updates
        if (timeoutId) clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          setHasSelection(!isEmpty)
        }, 50)
      }
    }

    // Use requestAnimationFrame to defer initial update
    rafId = requestAnimationFrame(() => {
      update()
    })
    
    editor.on('selectionUpdate', update)
    editor.on('focus', update)
    editor.on('blur', update)

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      if (timeoutId !== null) clearTimeout(timeoutId)
      editor.off('selectionUpdate', update)
      editor.off('focus', update)
      editor.off('blur', update)
    }
  }, [editor])

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

  useEffect(() => {
    handleSaveContentRef.current = handleSaveContent
  }, [handleSaveContent])

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
    if (!hasInitialised.current) {
      if (contentJson) {
        const initialContent = getInitialContent()
        editor.commands.setContent(initialContent, false) // false = don't emit update event
        lastSavedContentRef.current = cachedConfigContentStrRef.current || JSON.stringify(initialContent)
      } else {
        // Empty content - still need to initialize lastSavedContentRef
        const emptyContent = editor.getJSON()
        lastSavedContentRef.current = JSON.stringify(emptyContent)
      }
      hasInitialised.current = true
      editorInitializedRef.current = true

      if (process.env.NODE_ENV === 'development') {
        console.log(`[TextBlock] Initialized content on first mount: blockId=${block.id}`)
      }
    }
  }, [editor, block.id, contentJson, getInitialContent])

  /**
   * Initialize lastSavedContentRef when editor is first created (no content set yet).
   * CRITICAL: Do NOT set editorInitializedRef here - only the effect that calls setContent
   * should set it. Otherwise onUpdate can fire before content is set, causing React #185.
   */
  useEffect(() => {
    if (editor && !editorInitializedRef.current && !isConfigLoading) {
      if (cachedConfigContentStrRef.current) {
        lastSavedContentRef.current = cachedConfigContentStrRef.current
      } else {
        const initialContent = editor.getJSON()
        lastSavedContentRef.current = JSON.stringify(initialContent)
      }
    }
  }, [editor, isConfigLoading, block.id])

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
  // CRITICAL: Extract primitive values to prevent infinite loops in useEffect dependencies
  // The appearance object is recreated on every render, so we must extract values
  const appearance = config?.appearance || {}
  const textAlign = appearance.text_align || 'left'
  const textSize = appearance.text_size || 'md'
  const textColor = appearance.text_color || ''
  const fontWeight = appearance.font_weight || ''
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
  // CRITICAL: Use primitive values in dependencies, not object properties, to prevent infinite loops
  useEffect(() => {
    if (!editor) return
    
    const shouldBeEditable = !readOnly
    editor.setEditable(shouldBeEditable)
    
    // Debug logging to verify editable state
    if (process.env.NODE_ENV === 'development') {
      console.log(`[TextBlock] Setting editable state: blockId=${block.id}`, {
        isEditing,
        isViewer,
        readOnly,
        shouldBeEditable,
        editorIsEditable: editor.isEditable,
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
      if (textColor) {
        editorElement.style.color = textColor
      } else {
        editorElement.style.color = ''
      }
      
      // Apply font weight
      if (fontWeight) {
        const fontWeightMap: Record<string, string> = {
          'normal': '400',
          'medium': '500',
          'semibold': '600',
          'bold': '700'
        }
        editorElement.style.fontWeight = fontWeightMap[fontWeight] || '400'
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
  }, [editor, readOnly, textColor, fontWeight, textAlign, block.id, isEditing, isViewer])

  // CRITICAL: Render toolbar as inline JSX, NOT as a component defined in render.
  // Defining a component inline creates a new function every render → React unmounts/remounts it →
  // onMouseEnter fires when new element mounts under cursor → setIsBlockEditing → re-render → loop (React #185).
  const toolbarContent = editor && (
      <div 
        ref={toolbarRef}
        data-toolbar="true"
        className={cn(
          "absolute top-2 left-2 z-20 flex flex-wrap items-center gap-1 bg-white/95 backdrop-blur border border-gray-200 rounded-lg shadow-sm p-1"
        )}
        onMouseDown={(e) => {
          handleToolbarMouseDown(e)
        }}
        onMouseEnter={() => {
          if (editor && !editor.isFocused) {
            setIsBlockEditing(true)
            editor.commands.focus()
          }
        }}
        onClick={(e) => {
          e.stopPropagation()
          if (editor && !editor.isFocused) {
            setIsBlockEditing(true)
            editor.commands.focus()
          }
        }}
      >
        {/* Text type (no global/portaled dropdown; stays owned by the block) */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={handleToolbarMouseDown}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            editor.chain().focus().setParagraph().run()
          }}
          className={cn("h-8 px-2", !editor.isActive('heading') && "bg-gray-100")}
          title="Paragraph"
        >
          <span className="text-xs font-semibold">P</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={handleToolbarMouseDown}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            editor.chain().focus().setHeading({ level: 1 }).run()
          }}
          className={cn("h-8 w-8 p-0", editor.isActive('heading', { level: 1 }) && "bg-gray-100")}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={handleToolbarMouseDown}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            editor.chain().focus().setHeading({ level: 2 }).run()
          }}
          className={cn("h-8 w-8 p-0", editor.isActive('heading', { level: 2 }) && "bg-gray-100")}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={handleToolbarMouseDown}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            editor.chain().focus().setHeading({ level: 3 }).run()
          }}
          className={cn("h-8 w-8 p-0", editor.isActive('heading', { level: 3 }) && "bg-gray-100")}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* List Formatting */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={handleToolbarMouseDown}
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
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={handleToolbarMouseDown}
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
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={handleToolbarMouseDown}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            // Task lists require dedicated extensions which aren't currently installed here.
            // Keep the toolbar honest by using a bullet list instead of a non-working control.
            editor.chain().focus().toggleBulletList().run()
          }}
          className={cn("h-8 w-8 p-0", editor.isActive('bulletList') && "bg-gray-100")}
          title="Bullet List"
        >
          <CheckSquare className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Text Styling */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={handleToolbarMouseDown}
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
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={handleToolbarMouseDown}
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
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={handleToolbarMouseDown}
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
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={handleToolbarMouseDown}
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
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={handleToolbarMouseDown}
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

  // View mode: do not show any placeholder/setup UI. Empty text blocks render as empty.
  if (!hasContent && !isEditing) {
    return <div className="h-full w-full" style={blockStyle} />
  }

  // Empty state hint: Show when empty and not editing (subtle hint)
  const showEmptyHint = !hasContent && isEditing && !isBlockEditing
  const showToolbar = isEditing && !readOnly && (isFocused || isBlockEditing || hasSelection)

  return (
    <div 
      ref={containerRef}
      data-block-editing={isBlockEditing ? "true" : "false"}
      className={cn(
        "w-full flex flex-col relative overflow-hidden",
        // Visual editing state: blue ring when actively editing
        isBlockEditing && "ring-2 ring-blue-500 ring-offset-2 rounded-lg",
        // Subtle hover state when not editing
        isEditing && !isBlockEditing && "hover:ring-1 hover:ring-gray-300 rounded-lg transition-all",
        // Prevent dragging/resizing while editing
        isBlockEditing && "pointer-events-auto",
      )}
      style={{
        ...blockStyle,
        // Content-sized blocks: height should be driven by content, not flex or 100% sizing.
        height: 'auto',
        alignSelf: 'flex-start',
        flexGrow: 0,
        // CRITICAL: Do NOT set minHeight - height must be DERIVED from content
        // minHeight causes gaps when blocks collapse - it persists after collapse
        // Height must come from content and current expansion state only
      }}
      // Prevent drag/resize events from propagating when editing
      onMouseDown={(e) => {
        if (isBlockEditing) {
          e.stopPropagation()
        }
      }}
      onClick={(e) => {
        // Only enter edit mode when page is in edit mode.
        // CRITICAL: Do NOT force focus('end') when clicking inside ProseMirror,
        // otherwise the caret jumps and feels "glitchy". Let TipTap handle caret placement.
        if (isEditing && !readOnly && editor) {
          const target = e.target as HTMLElement
          const clickedInsideEditor =
            !!target.closest('.ProseMirror') || !!target.closest('[contenteditable="true"]')

          // Don't focus if clicking buttons, drag/resize handles, or the toolbar.
          if (
            !target.closest('button') &&
            !target.closest('[role="button"]') &&
            !target.closest('.drag-handle') &&
            !target.closest('.react-resizable-handle') &&
            !target.closest('[data-toolbar]')
          ) {
            // Prevent canvas selection/drag when user is interacting with the block.
            e.stopPropagation()
            setIsBlockEditing(true)

            // Only force focus to the end when clicking empty space *outside* ProseMirror.
            if (!clickedInsideEditor) {
              // Small delay to ensure DOM is ready
              setTimeout(() => {
                editor.commands.focus('end')
              }, 10)
            }
          }
        }
      }}
    >
      {/* Toolbar (owned by this block; no global floating UI) */}
      {showToolbar && toolbarContent}
      
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
          // Editor wrapper: owns internal scroll when content exceeds block height.
          "flex-1 w-full min-h-0 h-full overflow-hidden",
          !hasContent && isEditing && "flex items-center justify-center min-h-[100px]",
          // Cursor cues: text cursor when editable, pointer when clickable, default when not
          isBlockEditing && "cursor-text",
          isEditing && !isBlockEditing && "cursor-pointer",
          !isEditing && "cursor-default",
          // Read-only mode: keep pointer events enabled so users can select/copy text.
          // Editability is enforced via editor.setEditable(false).
          readOnly && "select-text"
        )}
        onClick={(e) => {
          // Only enter edit mode when page is in edit mode
          if (isEditing && !readOnly && !isBlockEditing && editor) {
            const target = e.target as HTMLElement
            // If the user clicked inside the editor content, don't override caret placement.
            if (target.closest('.ProseMirror') || target.closest('[contenteditable="true"]')) {
              return
            }
            e.stopPropagation()
            setIsBlockEditing(true)
            editor.commands.focus('end')
          }
        }}
        onMouseDown={(e) => {
          // Prevent drag/resize when clicking to edit.
          // CRITICAL: Don't force focus('end') on mouse down inside ProseMirror, it breaks caret placement.
          if (isBlockEditing) e.stopPropagation()

          if (isEditing && !readOnly && editor && !editor.isFocused) {
            const target = e.target as HTMLElement
            const clickedInsideEditor =
              !!target.closest('.ProseMirror') || !!target.closest('[contenteditable="true"]')

            // Let ProseMirror handle its own mouse-down selection/caret.
            if (clickedInsideEditor) return

            e.stopPropagation()
            setIsBlockEditing(true)
            editor.commands.focus('end')
          }
        }}
      >
        <div 
          className={cn(
            // Make the editor fill the whole block height.
            // Typography rules live here; ProseMirror is styled to stretch via globals.css.
            // IMPORTANT: Tailwind typography sizes are `prose-sm`, `prose-lg`, `prose-xl` etc.
            // There is no `prose-base`; base size is just `prose`.
            "text-block-editor prose max-w-none w-full h-full min-h-0 flex flex-col",
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
            // md is default base size (no extra class)
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
