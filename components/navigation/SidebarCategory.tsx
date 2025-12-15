'use client'

import { useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronRight } from 'lucide-react'
import { getIconComponent } from '@/lib/icons'
import { cn } from '@/lib/utils'
import SidebarItem from './SidebarItem'

interface SidebarCategoryProps {
  id: string
  name: string
  icon: string
  items: Array<{
    id: string
    label: string
    href: string
    icon: string | null
  }>
  children?: React.ReactNode
}

export default function SidebarCategory({
  id,
  name,
  icon,
  items,
  children,
}: SidebarCategoryProps) {
  const [isOpen, setIsOpen] = useState(true)

  // Dynamically get icon component
  const IconComponent = getIconComponent(icon)

  return (
    <div className="space-y-1">
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="group">
        <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-foreground hover:bg-accent">
          {IconComponent && <IconComponent className="h-4 w-4 text-muted-foreground" />}
          <span className="flex-1 text-left">{name}</span>
          <ChevronRight
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              isOpen && 'rotate-90'
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1 pl-6">
          {items.map((item) => (
            <SidebarItem
              key={item.id}
              id={item.id}
              label={item.label}
              href={item.href}
              icon={item.icon}
              level={1}
            />
          ))}
          {children}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
