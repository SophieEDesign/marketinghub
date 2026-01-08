'use client'

import { useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronRight, Folder, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import SidebarItem from './SidebarItem'
import PageCreationWizard from '../../baserow-app/components/interface/PageCreationWizard'

interface InterfaceSectionProps {
  interfaceId: string
  interfaceName: string
  pages: Array<{
    id: string
    name: string
    order_index: number
  }>
  defaultCollapsed?: boolean
  isAdmin?: boolean
}

export default function InterfaceSection({
  interfaceId,
  interfaceName,
  pages,
  defaultCollapsed = false,
  isAdmin = false,
}: InterfaceSectionProps) {
  const [isOpen, setIsOpen] = useState(!defaultCollapsed)
  const [newPageWizardOpen, setNewPageWizardOpen] = useState(false)

  // Sort pages by order_index
  const sortedPages = [...pages].sort((a, b) => a.order_index - b.order_index)

  // Check for duplicate names within this group for disambiguation
  const nameCounts = new Map<string, number>()
  sortedPages.forEach(page => {
    nameCounts.set(page.name, (nameCounts.get(page.name) || 0) + 1)
  })

  // Helper to get disambiguated label
  const getPageLabel = (page: { id: string; name: string; order_index: number }) => {
    const count = nameCounts.get(page.name) || 0
    if (count > 1) {
      // Multiple pages with same name - add UUID suffix for disambiguation
      const shortId = page.id.substring(0, 8)
      return `${page.name} (${shortId})`
    }
    return page.name
  }

  return (
    <div className="space-y-1">
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="group">
        <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-foreground hover:bg-accent">
          <Folder className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-left">{interfaceName}</span>
          <ChevronRight
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              isOpen && 'rotate-90'
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1 pl-6">
          {sortedPages.length > 0 ? (
            sortedPages.map((page) => (
              <SidebarItem
                key={page.id}
                id={page.id}
                label={getPageLabel(page)}
                href={`/pages/${page.id}`}
                icon="file-text"
                level={1}
              />
            ))
          ) : (
            <div className="px-2 py-2 text-xs text-muted-foreground">
              <p className="mb-1">No pages yet</p>
              {isAdmin && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setNewPageWizardOpen(true)
                  }}
                  className="text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add Page
                </button>
              )}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Page Creation Wizard Modal */}
      <PageCreationWizard
        open={newPageWizardOpen}
        onOpenChange={setNewPageWizardOpen}
        defaultGroupId={interfaceId}
      />
    </div>
  )
}

