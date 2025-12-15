'use client'

import { useState } from 'react'
import { createClientSupabaseClient } from '@/lib/supabase'
import { updateSidebarOrderClient } from '@/lib/navigation'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarReorderProps {
  items: Array<{ id: string; label: string }>
  type: 'items' | 'categories'
  onReorder?: () => void
}

export default function SidebarReorder({
  items,
  type,
  onReorder,
}: SidebarReorderProps) {
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [draggedOver, setDraggedOver] = useState<string | null>(null)
  const [reorderedItems, setReorderedItems] = useState(items)

  async function handleDragEnd() {
    if (!draggedItem) return

    const supabase = createClientSupabaseClient()
    const updates = reorderedItems.map((item, index) => ({
      id: item.id,
      position: index,
    }))

    await updateSidebarOrderClient(supabase, updates, type)
    setDraggedItem(null)
    setDraggedOver(null)
    onReorder?.()
  }

  function handleDragStart(itemId: string) {
    setDraggedItem(itemId)
  }

  function handleDragOver(itemId: string, e: React.DragEvent) {
    e.preventDefault()
    if (draggedItem && draggedItem !== itemId) {
      setDraggedOver(itemId)
      
      const draggedIndex = reorderedItems.findIndex((i) => i.id === draggedItem)
      const targetIndex = reorderedItems.findIndex((i) => i.id === itemId)
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        const newItems = [...reorderedItems]
        const [removed] = newItems.splice(draggedIndex, 1)
        newItems.splice(targetIndex, 0, removed)
        setReorderedItems(newItems)
      }
    }
  }

  return (
    <div className="space-y-1">
      {reorderedItems.map((item) => (
        <div
          key={item.id}
          draggable
          onDragStart={() => handleDragStart(item.id)}
          onDragOver={(e) => handleDragOver(item.id, e)}
          onDragEnd={handleDragEnd}
          className={cn(
            'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-move',
            draggedItem === item.id && 'opacity-50',
            draggedOver === item.id && 'bg-accent'
          )}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1">{item.label}</span>
        </div>
      ))}
    </div>
  )
}
