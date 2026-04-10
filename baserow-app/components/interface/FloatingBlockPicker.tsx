"use client"

import { useState } from "react"
import { Plus, X } from "lucide-react"
import type { BlockType } from "@/lib/interface/types"
import BlockPickerPanel from "@/components/interface/BlockPickerPanel"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface FloatingBlockPickerProps {
  onSelectBlock: (type: BlockType) => void
}

export default function FloatingBlockPicker({ onSelectBlock }: FloatingBlockPickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="fixed bottom-24 right-6 z-30 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
          title="Add block"
          style={{ zIndex: 30 }}
        >
          <Plus className="h-6 w-6" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end" side="top">
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-gray-900">Add Block</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
          </div>
          <BlockPickerPanel
            compact
            onSelectBlock={(type) => {
              onSelectBlock(type)
              setOpen(false)
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
