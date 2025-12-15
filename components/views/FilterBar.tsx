'use client'

import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
import type { ViewFilter } from '@/types/database'

interface FilterBarProps {
  viewId: string
  filters: ViewFilter[]
}

export default function FilterBar({ viewId, filters }: FilterBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {filters.map((filter) => (
        <Badge key={filter.id} variant="secondary" className="gap-2">
          {filter.field_name} {filter.operator} {filter.value}
          <X className="h-3 w-3 cursor-pointer" />
        </Badge>
      ))}
    </div>
  )
}
