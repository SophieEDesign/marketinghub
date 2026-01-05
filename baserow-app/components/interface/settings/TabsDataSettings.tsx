"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, GripVertical } from "lucide-react"
import type { BlockConfig } from "@/lib/interface/types"
import type { PageBlock } from "@/lib/interface/types"

interface TabConfig {
  id: string
  label: string
  block_ids: string[]
}

interface TabsDataSettingsProps {
  config: BlockConfig
  allBlocks: PageBlock[] // All blocks on the page (for assignment)
  onUpdate: (updates: Partial<BlockConfig>) => void
}

export default function TabsDataSettings({
  config,
  allBlocks,
  onUpdate,
}: TabsDataSettingsProps) {
  const tabs: TabConfig[] = config?.tabs || []
  const defaultTabId = config?.default_tab_id || tabs[0]?.id || null

  const addTab = () => {
    const newTab: TabConfig = {
      id: `tab-${Date.now()}`,
      label: `Tab ${tabs.length + 1}`,
      block_ids: [],
    }
    onUpdate({
      tabs: [...tabs, newTab],
      default_tab_id: tabs.length === 0 ? newTab.id : defaultTabId || undefined,
    })
  }

  const removeTab = (tabId: string) => {
    const newTabs = tabs.filter(t => t.id !== tabId)
    onUpdate({
      tabs: newTabs,
      default_tab_id: newTabs.length > 0 && defaultTabId === tabId 
        ? newTabs[0].id 
        : defaultTabId,
    })
  }

  const updateTab = (tabId: string, updates: Partial<TabConfig>) => {
    onUpdate({
      tabs: tabs.map(t => t.id === tabId ? { ...t, ...updates } : t),
    })
  }

  const toggleBlockAssignment = (tabId: string, blockId: string) => {
    const tab = tabs.find(t => t.id === tabId)
    if (!tab) return

    const hasBlock = tab.block_ids.includes(blockId)
    updateTab(tabId, {
      block_ids: hasBlock
        ? tab.block_ids.filter(id => id !== blockId)
        : [...tab.block_ids, blockId],
    })
  }

  const setDefaultTab = (tabId: string) => {
    onUpdate({ default_tab_id: tabId })
  }

  // Get blocks not assigned to any tab
  const assignedBlockIds = new Set(tabs.flatMap(t => t.block_ids))
  const unassignedBlocks = allBlocks.filter(b => !assignedBlockIds.has(b.id))

  return (
    <div className="space-y-4">
      {/* Tabs List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Tabs</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addTab}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Tab
          </Button>
        </div>

        {tabs.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-4 border rounded">
            No tabs yet. Click &quot;Add Tab&quot; to create one.
          </div>
        ) : (
          <div className="space-y-2">
            {tabs.map((tab, index) => (
              <div key={tab.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-gray-400" />
                  <Input
                    value={tab.label}
                    onChange={(e) => updateTab(tab.id, { label: e.target.value })}
                    placeholder="Tab label"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTab(tab.id)}
                    disabled={tabs.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Default tab toggle */}
                <div className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={defaultTabId === tab.id}
                    onChange={() => setDefaultTab(tab.id)}
                    className="cursor-pointer"
                  />
                  <Label className="cursor-pointer">Set as default tab</Label>
                </div>

                {/* Block assignment */}
                <div className="mt-2">
                  <Label className="text-xs text-gray-600 mb-1 block">
                    Assign blocks to this tab:
                  </Label>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {allBlocks.map((block) => {
                      const isAssigned = tab.block_ids.includes(block.id)
                      const blockDef = require('@/lib/interface/registry').BLOCK_REGISTRY[block.type]
                      return (
                        <label
                          key={block.id}
                          className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            onChange={() => toggleBlockAssignment(tab.id, block.id)}
                            className="cursor-pointer"
                          />
                          <span className="flex-1">
                            {block.config?.title || blockDef?.label || block.type}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unassigned blocks warning */}
      {unassignedBlocks.length > 0 && (
        <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
          {unassignedBlocks.length} block(s) not assigned to any tab. They won&apos;t be visible.
        </div>
      )}
    </div>
  )
}

