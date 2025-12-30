"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { PageBlock } from "@/lib/interface/types"
import { FileText } from "lucide-react"

interface TextBlockProps {
  block: PageBlock
  isEditing?: boolean
}

export default function TextBlock({ block, isEditing = false }: TextBlockProps) {
  const { config } = block
  const content = config?.content || config?.text || ""
  const markdown = config?.markdown !== false // Default to markdown enabled

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

  // Empty state
  if (!content && isEditing) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4" style={blockStyle}>
        <div className="text-center">
          <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="mb-1">Add text content</p>
          <p className="text-xs text-gray-400">Edit in settings to add text or markdown</p>
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
      <div className="flex-1 overflow-auto prose prose-sm max-w-none">
        {markdown ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        ) : (
          <div className="whitespace-pre-wrap">{content}</div>
        )}
      </div>
    </div>
  )
}
