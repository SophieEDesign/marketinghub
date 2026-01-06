"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { PageBlock } from "@/lib/interface/types"
import { FileText } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"

interface TextBlockProps {
  block: PageBlock
  isEditing?: boolean
  onUpdate?: (blockId: string, config: Partial<PageBlock["config"]>) => void
}

export default function TextBlock({ block, isEditing = false, onUpdate }: TextBlockProps) {
  const { config } = block
  const content = config?.content || config?.text_content || config?.text || ""
  const markdown = config?.markdown !== false // Default to markdown enabled

  // Local state for inline editing
  const [localContent, setLocalContent] = useState(content)
  const [isFocused, setIsFocused] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync local content when block config changes (from external updates)
  useEffect(() => {
    const newContent = config?.content || config?.text_content || config?.text || ""
    if (newContent !== localContent && !isFocused) {
      setLocalContent(newContent)
    }
  }, [config?.content, config?.text_content, config?.text])

  // Debounced save function
  const saveContent = useCallback((newContent: string) => {
    if (!onUpdate) return

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Debounce save: wait 800ms after last change
    saveTimeoutRef.current = setTimeout(() => {
      onUpdate(block.id, {
        content: newContent,
        text_content: newContent, // Also update legacy field for compatibility
      })
    }, 800)
  }, [block.id, onUpdate])

  // Handle content change
  const handleContentChange = (newContent: string) => {
    setLocalContent(newContent)
    saveContent(newContent)
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Apply appearance settings
  const appearance = config.appearance || {}
  const blockStyle: React.CSSProperties = {
    backgroundColor: appearance.background_color,
    borderColor: appearance.border_color,
    borderWidth: appearance.border_width !== undefined ? `${appearance.border_width}px` : '1px',
    borderRadius: appearance.border_radius !== undefined ? `${appearance.border_radius}px` : '8px',
    padding: appearance.padding !== undefined ? `${appearance.padding}px` : '16px',
    color: appearance.text_color || appearance.title_color,
  }

  const title = appearance.title || config.title
  const showTitle = appearance.show_title !== false && title

  // Empty state - only show in edit mode when not focused
  if (!localContent && isEditing && !isFocused) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4" style={blockStyle}>
        <div className="text-center">
          <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="mb-1">Click to add text content</p>
          <p className="text-xs text-gray-400">Supports markdown formatting</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full overflow-auto flex flex-col" style={blockStyle}>
      {showTitle && (
        <div
          className="mb-4 pb-2 border-b"
          style={{
            backgroundColor: appearance.header_background,
            color: appearance.header_text_color || appearance.title_color,
          }}
        >
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
      )}
      
      {isEditing ? (
        // Inline editing mode
        <div className="flex-1 flex flex-col">
          <Textarea
            ref={textareaRef}
            value={localContent}
            onChange={(e) => handleContentChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Enter text or markdown content..."
            className="flex-1 min-h-[200px] font-mono text-sm resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 bg-transparent"
            style={{
              color: appearance.text_color || appearance.title_color || 'inherit',
              textAlign: (appearance.text_align || 'left') as 'left' | 'center' | 'right' | 'justify',
              fontSize: appearance.text_size === 'sm' ? '0.875rem' :
                        appearance.text_size === 'lg' ? '1.125rem' :
                        appearance.text_size === 'xl' ? '1.25rem' :
                        '1rem',
            }}
          />
          {markdown && localContent && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-2">Preview:</p>
              <div 
                className="prose prose-sm max-w-none"
                style={{
                  textAlign: (appearance.text_align || 'left') as 'left' | 'center' | 'right' | 'justify',
                  fontSize: appearance.text_size === 'small' ? '0.875rem' :
                            appearance.text_size === 'large' ? '1.125rem' :
                            appearance.text_size === 'xlarge' ? '1.25rem' :
                            '1rem',
                }}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {localContent}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      ) : (
        // View mode - render content
        <div 
          className="flex-1 overflow-auto prose prose-sm max-w-none"
          style={{
            textAlign: (appearance.text_align || 'left') as 'left' | 'center' | 'right' | 'justify',
            fontSize: appearance.text_size === 'small' ? '0.875rem' :
                      appearance.text_size === 'large' ? '1.125rem' :
                      appearance.text_size === 'xlarge' ? '1.25rem' :
                      '1rem',
          }}
        >
          {markdown && localContent ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {localContent}
            </ReactMarkdown>
          ) : (
            <div className="whitespace-pre-wrap">{localContent}</div>
          )}
        </div>
      )}
    </div>
  )
}
