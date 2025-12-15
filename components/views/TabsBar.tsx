'use client'

import { useState } from 'react'
import { createClientSupabaseClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, X, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ViewTab } from '@/types/database'

interface TabsBarProps {
  viewId: string
  tabs: ViewTab[]
  activeTabId: string | null
  onTabChange: (tabId: string | null) => void
  editing: boolean
  onTabsChange: (tabs: ViewTab[]) => void
}

export default function TabsBar({
  viewId,
  tabs,
  activeTabId,
  onTabChange,
  editing,
  onTabsChange,
}: TabsBarProps) {
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null)

  async function handleAddTab() {
    const supabase = createClientSupabaseClient()
    
    // Get max position
    const maxPosition = tabs.length > 0 
      ? Math.max(...tabs.map(t => t.position)) + 1
      : 0

    const { data, error } = await supabase
      .from('view_tabs')
      .insert([
        {
          view_id: viewId,
          name: `Tab ${tabs.length + 1}`,
          position: maxPosition,
        },
      ])
      .select()
      .single()

    if (!error && data) {
      onTabsChange([...tabs, data as ViewTab])
      onTabChange(data.id)
    }
  }

  async function handleRenameTab(tabId: string, newName: string) {
    if (!newName.trim()) return

    const supabase = createClientSupabaseClient()
    const { error } = await supabase
      .from('view_tabs')
      .update({ name: newName.trim() })
      .eq('id', tabId)

    if (!error) {
      onTabsChange(
        tabs.map((tab) => (tab.id === tabId ? { ...tab, name: newName.trim() } : tab))
      )
    }
    setRenamingTabId(null)
  }

  async function handleDeleteTab(tabId: string) {
    if (tabs.length <= 1) return // Don't delete last tab

    const supabase = createClientSupabaseClient()
    const { error } = await supabase.from('view_tabs').delete().eq('id', tabId)

    if (!error) {
      const newTabs = tabs.filter((t) => t.id !== tabId)
      onTabsChange(newTabs)
      
      // Switch to first tab if deleted tab was active
      if (activeTabId === tabId && newTabs.length > 0) {
        onTabChange(newTabs[0].id)
      } else if (newTabs.length === 0) {
        onTabChange(null)
      }
    }
  }

  async function handleReorderTabs(reorderedTabs: ViewTab[]) {
    const supabase = createClientSupabaseClient()
    
    const updates = reorderedTabs.map((tab, index) =>
      supabase
        .from('view_tabs')
        .update({ position: index })
        .eq('id', tab.id)
    )

    await Promise.all(updates)
    onTabsChange(reorderedTabs)
  }

  function handleDragStart(tabId: string) {
    setDraggedTabId(tabId)
  }

  function handleDragOver(tabId: string, e: React.DragEvent) {
    e.preventDefault()
    if (!draggedTabId || draggedTabId === tabId) return

    const draggedIndex = tabs.findIndex((t) => t.id === draggedTabId)
    const targetIndex = tabs.findIndex((t) => t.id === tabId)

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const newTabs = [...tabs]
      const [removed] = newTabs.splice(draggedIndex, 1)
      newTabs.splice(targetIndex, 0, removed)
      handleReorderTabs(newTabs)
    }
  }

  function handleDragEnd() {
    setDraggedTabId(null)
  }

  const sortedTabs = [...tabs].sort((a, b) => a.position - b.position)

  return (
    <div className="flex items-center gap-2 border-b bg-background">
      <div className="flex items-center gap-1 overflow-x-auto">
        {sortedTabs.map((tab) => (
          <div
            key={tab.id}
            draggable={editing}
            onDragStart={() => handleDragStart(tab.id)}
            onDragOver={(e) => handleDragOver(tab.id, e)}
            onDragEnd={handleDragEnd}
            className={cn(
              'flex items-center gap-1 px-4 py-2 border-b-2 transition-colors cursor-pointer',
              activeTabId === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
              editing && 'cursor-move'
            )}
            onClick={() => !editing && onTabChange(tab.id)}
          >
            {editing && <GripVertical className="h-3 w-3 text-muted-foreground" />}
            {renamingTabId === tab.id ? (
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => handleRenameTab(tab.id, renameValue)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRenameTab(tab.id, renameValue)
                  }
                  if (e.key === 'Escape') {
                    setRenamingTabId(null)
                  }
                }}
                className="h-6 w-24 text-sm"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <span
                  className="text-sm font-medium"
                  onDoubleClick={() => {
                    if (editing) {
                      setRenamingTabId(tab.id)
                      setRenameValue(tab.name)
                    }
                  }}
                >
                  {tab.name}
                </span>
                {editing && tabs.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteTab(tab.id)
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      {editing && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAddTab}
          className="shrink-0"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Tab
        </Button>
      )}
    </div>
  )
}
