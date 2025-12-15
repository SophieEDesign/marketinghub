'use client'

import { useState, useEffect } from 'react'
import { createClientSupabaseClient } from '@/lib/supabase'
import { updateViewBlockLayoutClient } from '@/lib/blocks'
import BlockRenderer from '@/components/blocks/BlockRenderer'
import TabsBar from './TabsBar'
import AddBlockMenu from './AddBlockMenu'
import BlockSettingsPanel from './BlockSettingsPanel'
import { Button } from '@/components/ui/button'
import { Edit2, Check } from 'lucide-react'
import type { ViewBlock, ViewTab } from '@/types/database'

interface InterfacePageProps {
  viewId: string
  blocks: ViewBlock[]
  tabs: ViewTab[]
}

export default function InterfacePage({
  viewId,
  blocks: initialBlocks,
  tabs: initialTabs,
}: InterfacePageProps) {
  const [editing, setEditing] = useState(false)
  const [blocks, setBlocks] = useState<ViewBlock[]>(initialBlocks)
  const [tabs, setTabs] = useState<ViewTab[]>(initialTabs)
  const [activeTabId, setActiveTabId] = useState<string | null>(
    initialTabs.length > 0 ? initialTabs[0].id : null
  )
  const [selectedBlock, setSelectedBlock] = useState<ViewBlock | null>(null)
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false)

  // Filter blocks by active tab
  const visibleBlocks = blocks.filter((block) => {
    const tabId = block.settings?.tab_id
    if (!activeTabId) return !tabId // Show blocks without tab_id when no tab is active
    return tabId === activeTabId
  })

  async function handleLayoutChange(layout: any) {
    if (!editing) return

    const supabase = createClientSupabaseClient()
    const updates = layout.map((item: any) => ({
      id: item.i,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    }))

    await updateViewBlockLayoutClient(supabase, updates)
    
    // Update local state
    setBlocks((prevBlocks) =>
      prevBlocks.map((block) => {
        const update = updates.find((u: any) => u.id === block.id)
        if (update) {
          return {
            ...block,
            position: { x: update.x, y: update.y, w: update.w, h: update.h },
          }
        }
        return block
      })
    )
  }

  async function handleBlockAdded() {
    // Reload blocks
    const supabase = createClientSupabaseClient()
    const { data } = await supabase
      .from('view_blocks')
      .select('*')
      .eq('view_id', viewId)

    if (data) {
      setBlocks(data as ViewBlock[])
    }
  }

  async function handleBlockUpdated() {
    // Reload blocks
    const supabase = createClientSupabaseClient()
    const { data } = await supabase
      .from('view_blocks')
      .select('*')
      .eq('view_id', viewId)

    if (data) {
      setBlocks(data as ViewBlock[])
    }
    setSelectedBlock(null)
  }

  function handleBlockSettingsClick(block: ViewBlock) {
    setSelectedBlock(block)
    setSettingsPanelOpen(true)
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header with Edit Toggle */}
      <div className="flex items-center justify-between p-6 border-b bg-background">
        <div className="flex-1" />
        <Button
          variant={editing ? 'default' : 'outline'}
          onClick={() => setEditing(!editing)}
        >
          {editing ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Done Editing
            </>
          ) : (
            <>
              <Edit2 className="mr-2 h-4 w-4" />
              Edit Interface
            </>
          )}
        </Button>
      </div>

      {/* Tabs Bar */}
      {tabs.length > 0 && (
        <TabsBar
          viewId={viewId}
          tabs={tabs}
          activeTabId={activeTabId}
          onTabChange={setActiveTabId}
          editing={editing}
          onTabsChange={setTabs}
        />
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-6">
        {/* Add Block Menu (only in edit mode) */}
        {editing && (
          <div className="mb-4">
            <AddBlockMenu
              viewId={viewId}
              activeTabId={activeTabId}
              onBlockAdded={handleBlockAdded}
            />
          </div>
        )}

        {/* Block Renderer */}
        {visibleBlocks.length > 0 ? (
          <BlockRenderer
            blocks={visibleBlocks}
            editing={editing}
            onLayoutChange={handleLayoutChange}
            onBlockSettingsClick={handleBlockSettingsClick}
          />
        ) : (
          <div className="text-center py-12 text-muted-foreground border rounded-lg">
            {editing ? (
              <div>
                <p className="mb-2">No blocks in this tab yet.</p>
                <p className="text-sm">Click "Add Block" to get started.</p>
              </div>
            ) : (
              <p>No blocks to display.</p>
            )}
          </div>
        )}
      </div>

      {/* Block Settings Panel */}
      <BlockSettingsPanel
        block={selectedBlock}
        open={settingsPanelOpen}
        onOpenChange={setSettingsPanelOpen}
        onBlockUpdated={handleBlockUpdated}
      />
    </div>
  )
}
