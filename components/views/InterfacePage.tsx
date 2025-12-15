'use client'

import { useState } from 'react'
import { createClientSupabaseClient } from '@/lib/supabase'
import BlockRenderer from '@/components/blocks/BlockRenderer'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import type { ViewBlock } from '@/types/database'

interface InterfacePageProps {
  viewId: string
  blocks: ViewBlock[]
}

export default function InterfacePage({ viewId, blocks }: InterfacePageProps) {
  const [editing, setEditing] = useState(false)

  async function handleLayoutChange(layout: any) {
    if (!editing) return

    const supabase = createClientSupabaseClient()
    const { updateViewBlockLayoutClient } = await import('@/lib/blocks')
    
    const updates = layout.map((item: any) => ({
      id: item.i,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    }))

    await updateViewBlockLayoutClient(supabase, updates)
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Interface Page</h2>
        <div className="flex gap-2">
          <Button
            variant={editing ? 'default' : 'outline'}
            onClick={() => setEditing(!editing)}
          >
            {editing ? 'Done Editing' : 'Edit Layout'}
          </Button>
          {editing && (
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Block
            </Button>
          )}
        </div>
      </div>

      {blocks.length > 0 ? (
        <BlockRenderer
          blocks={blocks}
          editing={editing}
          onLayoutChange={handleLayoutChange}
        />
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          No blocks yet. Add blocks to build your interface.
        </div>
      )}
    </div>
  )
}
