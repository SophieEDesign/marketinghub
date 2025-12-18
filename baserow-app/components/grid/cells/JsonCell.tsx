"use client"

import { useState } from 'react'
import { FileJson } from 'lucide-react'

interface JsonCellProps {
  value: any
  fieldName: string
  editable?: boolean
  onSave?: (value: any) => Promise<void>
  placeholder?: string
}

export default function JsonCell({
  value,
  fieldName,
  editable = false,
  onSave,
  placeholder = '—',
}: JsonCellProps) {
  const [expanded, setExpanded] = useState(false)

  const formatJson = (val: any): string => {
    if (val === null || val === undefined) return ''
    try {
      return JSON.stringify(val, null, 2)
    } catch {
      return String(val)
    }
  }

  const getPreview = (val: any): string => {
    if (val === null || val === undefined) return placeholder
    try {
      const str = JSON.stringify(val)
      return str.length > 50 ? str.substring(0, 50) + '...' : str
    } catch {
      return String(val)
    }
  }

  const displayValue = value
  const preview = getPreview(displayValue)
  const isPlaceholder = value === null || value === undefined

  return (
    <div className="w-full h-full px-2 flex items-center gap-1 text-sm">
      <FileJson className="h-3 w-3 text-gray-400 flex-shrink-0" />
      {expanded ? (
        <div className="flex-1 min-w-0">
          <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-words">
            {formatJson(displayValue)}
          </pre>
          <button
            onClick={() => setExpanded(false)}
            className="text-xs text-blue-600 hover:text-blue-800 mt-1"
          >
            Collapse
          </button>
        </div>
      ) : (
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className={`truncate ${isPlaceholder ? 'text-gray-400' : 'text-gray-900'}`}>
            {preview}
          </span>
          {!isPlaceholder && (
            <button
              onClick={() => setExpanded(true)}
              className="text-xs text-blue-600 hover:text-blue-800 flex-shrink-0"
            >
              Expand
            </button>
          )}
        </div>
      )}
    </div>
  )
}
