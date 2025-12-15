'use client'

import { Badge } from '@/components/ui/badge'
import { ArrowUp, ArrowDown, X } from 'lucide-react'
import type { ViewSort } from '@/types/database'

interface SortBarProps {
  viewId: string
  sorts: ViewSort[]
}

export default function SortBar({ viewId, sorts }: SortBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {sorts.map((sort) => (
        <Badge key={sort.id} variant="secondary" className="gap-2">
          {sort.field_name}
          {sort.direction === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )}
          <X className="h-3 w-3 cursor-pointer" />
        </Badge>
      ))}
    </div>
  )
}
