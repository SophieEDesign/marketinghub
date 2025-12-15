'use client'

import { useState } from 'react'
import { createClientSupabaseClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { X } from 'lucide-react'
import { updateRowClient } from '@/lib/data'
import type { ViewField } from '@/types/database'

interface RowDetailProps {
  row: Record<string, any>
  tableId: string
  visibleFields: ViewField[]
  onClose?: () => void
}

export default function RowDetail({
  row,
  tableId,
  visibleFields,
  onClose,
}: RowDetailProps) {
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>(row)

  async function handleSave() {
    const supabase = createClientSupabaseClient()
    await updateRowClient(supabase, tableId, row.id, formData)
    setEditing(false)
    if (onClose) onClose()
    window.location.reload()
  }

  function handleFieldChange(fieldName: string, value: any) {
    setFormData((prev) => ({ ...prev, [fieldName]: value }))
  }

  const content = (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Row Details</CardTitle>
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>Save</Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {visibleFields.map((field) => (
            <div key={field.id} className="space-y-2">
              <label className="text-sm font-medium">
                {field.field_name}
              </label>
              {editing ? (
                <input
                  type="text"
                  value={formData[field.field_name] || ''}
                  onChange={(e) =>
                    handleFieldChange(field.field_name, e.target.value)
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              ) : (
                <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
                  {String(row[field.field_name] || '—')}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )

  if (onClose) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Row Details</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    )
  }

  return content
}
