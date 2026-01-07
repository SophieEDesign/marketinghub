"use client"

import { Label } from "@/components/ui/label"
import type { BlockConfig } from "@/lib/interface/types"

interface TextDataSettingsProps {
  config: BlockConfig
  tables: any[]
  views: any[]
  fields: any[]
  onUpdate: (updates: Partial<BlockConfig>) => void
  onTableChange: (tableId: string) => Promise<void>
}

/**
 * TextDataSettings - Read-only preview only
 * 
 * CRITICAL: Text editing is done inline in the block itself.
 * This settings panel only shows a preview and instructions.
 * No editing capability here - all editing happens in TextBlock component.
 */
export default function TextDataSettings({
  config,
}: TextDataSettingsProps) {
  // Get content from config.content_json ONLY
  const contentJson = config?.content_json || null
  
  // Check if content exists
  const hasContent = contentJson !== null && 
                     typeof contentJson === 'object' && 
                     contentJson.type === 'doc' &&
                     Array.isArray(contentJson.content) &&
                     contentJson.content.length > 0

  return (
    <div className="space-y-4">
      {/* Info Message */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-sm text-blue-800">
          <strong>Inline Editing:</strong> Click directly on the text block to edit inline. 
          Use the formatting toolbar for rich text formatting (bold, italic, headings, lists, links).
        </p>
      </div>

      {/* Content Status */}
      <div className="space-y-2">
        <Label>Content Status</Label>
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
          {hasContent ? (
            <div className="text-sm text-gray-700">
              <p className="font-medium text-green-700 mb-1">✓ Content configured</p>
              <p className="text-xs text-gray-500">
                Content is stored in <code className="bg-gray-200 px-1 rounded">config.content_json</code>
              </p>
            </div>
          ) : (
            <div className="text-sm text-gray-700">
              <p className="font-medium text-gray-500 mb-1">No content yet</p>
              <p className="text-xs text-gray-400">
                Click on the text block in edit mode to add content.
              </p>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500">
          All text editing happens directly in the block. Enter edit mode and click on the block to start typing.
        </p>
      </div>
    </div>
  )
}
