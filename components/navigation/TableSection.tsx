'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { ChevronRight, Plus, Database } from 'lucide-react'
import { cn } from '@/lib/utils'
import SidebarItem from './SidebarItem'

interface TableSectionProps {
  tableId: string
  tableName: string
  views: Array<{
    id: string
    name: string
    type: string
  }>
}

export default function TableSection({
  tableId,
  tableName,
  views,
}: TableSectionProps) {
  const [isOpen, setIsOpen] = useState(false)

  function getViewIcon(type: string): string {
    const iconMap: Record<string, string> = {
      grid: 'table',
      kanban: 'columns',
      calendar: 'calendar',
      form: 'file-text',
      gallery: 'image',
      page: 'layout-dashboard',
    }
    return iconMap[type] || 'file'
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="group">
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-foreground hover:bg-accent">
        <ChevronRight
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            isOpen && 'rotate-90'
          )}
        />
        <Link
          href={`/tables/${tableId}`}
          className="flex items-center gap-2 flex-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Database className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">{tableName}</span>
        </Link>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 pl-6">
        {views.map((view) => (
          <SidebarItem
            key={view.id}
            id={view.id}
            label={view.name}
            href={`/tables/${tableId}/views/${view.id}`}
            icon={getViewIcon(view.type)}
            level={1}
          />
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          asChild
        >
          <Link href={`/data/${tableId}/views/new`}>
            <Plus className="mr-2 h-3 w-3" />
            Add View
          </Link>
        </Button>
      </CollapsibleContent>
    </Collapsible>
  )
}
