'use client'

import { Button } from '@/components/ui/button'
import { Plus, Filter, ArrowUpDown } from 'lucide-react'

interface ViewToolbarProps {
  viewId: string
  onAddRow?: () => void
  showFilters?: boolean
  showSorts?: boolean
}

export default function ViewToolbar({
  viewId,
  onAddRow,
  showFilters = false,
  showSorts = false,
}: ViewToolbarProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {onAddRow && (
          <Button onClick={onAddRow} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Row
          </Button>
        )}
        {showFilters && (
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
        )}
        {showSorts && (
          <Button variant="outline" size="sm">
            <ArrowUpDown className="mr-2 h-4 w-4" />
            Sort
          </Button>
        )}
      </div>
    </div>
  )
}
