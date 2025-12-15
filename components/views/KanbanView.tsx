'use client'

import { useState, useEffect } from 'react'
import { createClientSupabaseClient } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import ViewToolbar from './ViewToolbar'
import type { ViewField } from '@/types/database'

interface KanbanViewProps {
  tableId: string
  viewId: string
  rows: Record<string, any>[]
  visibleFields: ViewField[]
}

export default function KanbanView({
  tableId,
  viewId,
  rows,
  visibleFields,
}: KanbanViewProps) {
  const [groupingFieldName, setGroupingFieldName] = useState<string>(
    visibleFields[0]?.field_name || ''
  )

  function groupRowsByField() {
    if (!groupingFieldName) return {}

    const groups: Record<string, Record<string, any>[]> = {}
    rows.forEach((row) => {
      const groupValue = String(row[groupingFieldName] || 'Uncategorized')
      if (!groups[groupValue]) {
        groups[groupValue] = []
      }
      groups[groupValue].push(row)
    })

    return groups
  }

  const groupedRows = groupRowsByField()
  const groups = Object.keys(groupedRows)

  return (
    <div className="w-full space-y-4">
      <ViewToolbar viewId={viewId} />
      
      <div className="w-full overflow-x-auto">
        <div className="flex gap-4 min-w-max p-4">
          {groups.map((groupName) => (
            <div key={groupName} className="flex-shrink-0 w-80">
              <div className="bg-muted/50 rounded-lg p-3 mb-2 font-medium">
                {groupName} ({groupedRows[groupName].length})
              </div>
              <div className="space-y-2">
                {groupedRows[groupName].map((row) => (
                  <Card key={row.id} className="cursor-pointer hover:shadow-md">
                    <CardContent className="p-3">
                      <div className="space-y-1">
                        {visibleFields
                          .filter((f) => f.field_name !== groupingFieldName)
                          .slice(0, 3)
                          .map((field) => (
                            <div key={field.id} className="text-sm">
                              <span className="text-muted-foreground">
                                {field.field_name}:{' '}
                              </span>
                              <span>{String(row[field.field_name] || '')}</span>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Button variant="ghost" size="sm" className="w-full mt-2">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Card
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
