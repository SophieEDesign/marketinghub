"use client"

import { useState } from "react"
import type { PageBlock } from "@/lib/interface/types"
import BlockRenderer from "../BlockRenderer"

interface TabsBlockProps {
  block: PageBlock
  isEditing?: boolean
  childBlocks?: PageBlock[] // Blocks that belong to this tab container
}

interface TabConfig {
  id: string
  label: string
  block_ids: string[] // IDs of blocks that belong to this tab
}

export default function TabsBlock({ 
  block, 
  isEditing = false,
  childBlocks = []
}: TabsBlockProps) {
  const { config } = block
  const tabs: TabConfig[] = config?.tabs || []
  const defaultTabId = config?.default_tab_id || tabs[0]?.id || null
  const [activeTabId, setActiveTabId] = useState<string | null>(defaultTabId)

  // Group child blocks by tab
  const blocksByTab = tabs.reduce((acc, tab) => {
    acc[tab.id] = childBlocks.filter(b => tab.block_ids.includes(b.id))
    return acc
  }, {} as Record<string, PageBlock[]>)

  // Get blocks for active tab
  const activeBlocks = activeTabId ? blocksByTab[activeTabId] || [] : []

  // If no tabs configured, show empty state
  if (!tabs || tabs.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-8">
        <div className="text-center text-gray-500">
          <p className="font-semibold mb-2">No tabs configured</p>
          <p className="text-sm">
            {isEditing 
              ? "Open settings to add tabs and assign blocks to them"
              : "This tabs block is not configured"}
          </p>
        </div>
      </div>
    )
  }

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0]

  return (
    <div className="h-full flex flex-col">
      {/* Tab Headers */}
      <div className="flex border-b bg-gray-50">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId
          return (
            <button
              key={tab.id}
              onClick={() => !isEditing && setActiveTabId(tab.id)}
              disabled={isEditing}
              className={`
                px-4 py-2 text-sm font-medium border-b-2 transition-colors
                ${isActive 
                  ? 'border-blue-500 text-blue-600 bg-white' 
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }
                ${isEditing ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
              `}
            >
              {tab.label || `Tab ${tab.id.slice(0, 8)}`}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeBlocks.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            {isEditing 
              ? "No blocks assigned to this tab. Add blocks in settings."
              : "This tab is empty"}
          </div>
        ) : (
          <div className="space-y-4">
            {activeBlocks.map((childBlock) => (
              <div key={childBlock.id} className="border rounded-lg p-4">
                <BlockRenderer
                  block={childBlock}
                  isEditing={isEditing}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

