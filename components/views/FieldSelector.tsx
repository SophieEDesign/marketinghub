'use client'

import { Button } from '@/components/ui/button'
import { Eye, EyeOff } from 'lucide-react'
import type { ViewField } from '@/types/database'

interface FieldSelectorProps {
  fields: ViewField[]
  onToggleVisibility?: (fieldId: string) => void
}

export default function FieldSelector({
  fields,
  onToggleVisibility,
}: FieldSelectorProps) {
  return (
    <div className="space-y-2">
      {fields.map((field) => (
        <div
          key={field.id}
          className="flex items-center justify-between p-2 border rounded"
        >
          <span className="text-sm">{field.field_name}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleVisibility?.(field.id)}
          >
            {!field.visible ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        </div>
      ))}
    </div>
  )
}
