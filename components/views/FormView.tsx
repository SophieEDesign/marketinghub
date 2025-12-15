'use client'

import { useState } from 'react'
import { createClientSupabaseClient } from '@/lib/supabase'
import { createRowClient, updateRowClient } from '@/lib/data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Save } from 'lucide-react'
import type { ViewField } from '@/types/database'

interface FormViewProps {
  tableId: string
  viewId: string
  visibleFields: ViewField[]
  rowId?: string
  initialData?: Record<string, any>
}

export default function FormView({
  tableId,
  viewId,
  visibleFields,
  rowId,
  initialData,
}: FormViewProps) {
  const [formData, setFormData] = useState<Record<string, any>>(
    initialData || {}
  )
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const supabase = createClientSupabaseClient()

    try {
      if (rowId && initialData) {
        await updateRowClient(supabase, tableId, rowId, formData)
      } else {
        await createRowClient(supabase, tableId, formData)
      }
      window.location.reload()
    } catch (error) {
      console.error('Error saving:', error)
      setSaving(false)
    }
  }

  function handleFieldChange(fieldName: string, value: any) {
    setFormData((prev) => ({ ...prev, [fieldName]: value }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{rowId ? 'Edit Record' : 'New Record'}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {visibleFields.map((field) => (
            <div key={field.id} className="space-y-2">
              <label className="text-sm font-medium">
                {field.field_name}
              </label>
              <Input
                value={formData[field.field_name] || ''}
                onChange={(e) =>
                  handleFieldChange(field.field_name, e.target.value)
                }
              />
            </div>
          ))}
          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
