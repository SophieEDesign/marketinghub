"use client"

import { ReactNode } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/context-menu/ContextMenu'
import { Copy, ClipboardPaste } from 'lucide-react'

interface CellContextMenuProps {
  children: ReactNode
  value: any
  fieldName: string
  editable?: boolean
  onCopy?: () => void
  onPaste?: () => void
  formatValue?: (value: any) => string
}

export default function CellContextMenu({
  children,
  value,
  fieldName,
  editable = true,
  onCopy,
  onPaste,
  formatValue,
}: CellContextMenuProps) {
  const handleCopy = async () => {
    let textToCopy = ''
    if (formatValue) {
      textToCopy = formatValue(value)
    } else if (value === null || value === undefined) {
      textToCopy = ''
    } else if (typeof value === 'string') {
      textToCopy = value
    } else if (Array.isArray(value)) {
      textToCopy = value.join(', ')
    } else {
      textToCopy = String(value)
    }

    if (textToCopy) {
      try {
        await navigator.clipboard.writeText(textToCopy)
        if (onCopy) onCopy()
      } catch (err) {
        console.error('Failed to copy:', err)
      }
    }
  }

  const handlePaste = async () => {
    if (onPaste) {
      try {
        const text = await navigator.clipboard.readText()
        if (text && onPaste) {
          onPaste()
        }
      } catch (err) {
        console.error('Failed to read clipboard:', err)
      }
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleCopy}>
          <Copy className="h-4 w-4 mr-2" />
          Copy
        </ContextMenuItem>
        {editable && (
          <ContextMenuItem onClick={handlePaste}>
            <ClipboardPaste className="h-4 w-4 mr-2" />
            Paste
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
