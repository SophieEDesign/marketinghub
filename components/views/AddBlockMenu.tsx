'use client'

import { useState } from 'react'
import { createClientSupabaseClient } from '@/lib/supabase'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Plus, Type, Image, Code, BarChart3, Table, FileText, Minus, Zap } from 'lucide-react'
import type { BlockType } from '@/types/database'

interface AddBlockMenuProps {
  viewId: string
  activeTabId: string | null
  onBlockAdded: () => void
}

const blockTypes: Array<{
  type: BlockType
  label: string
  icon: React.ComponentType<{ className?: string }>
  defaultSettings: Record<string, any>
}> = [
  {
    type: 'text',
    label: 'Text',
    icon: Type,
    defaultSettings: { content: '' },
  },
  {
    type: 'image',
    label: 'Image',
    icon: Image,
    defaultSettings: { src: '', alt: '' },
  },
  {
    type: 'embed',
    label: 'Embed',
    icon: Code,
    defaultSettings: { url: '' },
  },
  {
    type: 'stat',
    label: 'Stat',
    icon: BarChart3,
    defaultSettings: { label: 'Stat', value: 0 },
  },
  {
    type: 'table',
    label: 'Table',
    icon: Table,
    defaultSettings: { tableId: '' },
  },
  {
    type: 'chart',
    label: 'Chart',
    icon: BarChart3,
    defaultSettings: { chartType: 'bar', data: [] },
  },
  {
    type: 'automation',
    label: 'Automation',
    icon: Zap,
    defaultSettings: { automationId: '', status: 'inactive' },
  },
  {
    type: 'html',
    label: 'HTML',
    icon: Code,
    defaultSettings: { html: '' },
  },
  {
    type: 'divider',
    label: 'Divider',
    icon: Minus,
    defaultSettings: {},
  },
]

export default function AddBlockMenu({
  viewId,
  activeTabId,
  onBlockAdded,
}: AddBlockMenuProps) {
  const [open, setOpen] = useState(false)

  async function handleAddBlock(type: BlockType, defaultSettings: Record<string, any>) {
    const supabase = createClientSupabaseClient()

    // Get existing blocks to calculate position
    const { data: existingBlocks } = await supabase
      .from('view_blocks')
      .select('position')
      .eq('view_id', viewId)

    // Find max Y position
    const maxY = existingBlocks?.length
      ? Math.max(...existingBlocks.map((b: any) => b.position?.y || 0))
      : -1

    // Add settings with tab_id
    const settings = {
      ...defaultSettings,
      tab_id: activeTabId,
    }

    const { error } = await supabase.from('view_blocks').insert([
      {
        view_id: viewId,
        type,
        position: { x: 0, y: maxY + 1, w: 12, h: 4 },
        settings,
      },
    ])

    if (!error) {
      setOpen(false)
      onBlockAdded()
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Block
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" onClick={(e) => e.stopPropagation()}>
        <div className="grid grid-cols-2 gap-2">
          {blockTypes.map((blockType) => {
            const Icon = blockType.icon
            return (
              <Button
                key={blockType.type}
                variant="outline"
                className="h-auto flex-col gap-2 p-4"
                onClick={() => handleAddBlock(blockType.type, blockType.defaultSettings)}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs">{blockType.label}</span>
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
