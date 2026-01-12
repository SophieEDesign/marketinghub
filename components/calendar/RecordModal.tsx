"use client"

import { useState, useEffect } from 'react'
import { ArrowLeft, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { TableField } from '@/types/fields'
import FieldEditor from '@/components/fields/FieldEditor'

interface RecordModalProps {
  open: boolean
  onClose: () => void
  tableId: string
  recordId: string | null
  tableFields: TableField[]
  onSave?: () => void
}

export default function RecordModal({
  open,
  onClose,
  tableId,
  recordId,
  tableFields,
  onSave,
}: RecordModalProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [supabaseTableName, setSupabaseTableName] = useState<string | null>(null)

  // Load table info first
  useEffect(() => {
    if (open && tableId) {
      loadTableInfo()
    } else {
      setSupabaseTableName(null)
      setFormData({})
    }
  }, [open, tableId])

  // Load record data after table info is loaded
  useEffect(() => {
    if (open && recordId && supabaseTableName) {
      loadRecord()
    } else {
      setFormData({})
    }
  }, [open, recordId, supabaseTableName])

  async function loadTableInfo() {
    if (!tableId) return
    
    try {
      const supabase = createClient()
      const { data: table, error } = await supabase
        .from('tables')
        .select('supabase_table')
        .eq('id', tableId)
        .single()
      
      if (error) {
        console.error('Error loading table info:', error)
        setSupabaseTableName(null)
      } else if (table) {
        setSupabaseTableName(table.supabase_table)
      }
    } catch (error) {
      console.error('Error loading table info:', error)
      setSupabaseTableName(null)
    }
  }

  async function loadRecord() {
    if (!recordId || !supabaseTableName) return

    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from(supabaseTableName)
        .select('*')
        .eq('id', recordId)
        .single()

      if (error) {
        console.error('Error loading record:', error)
        setFormData({})
      } else if (data) {
        setFormData(data)
      }
    } catch (error) {
      console.error('Error loading record:', error)
      setFormData({})
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!supabaseTableName || !recordId) return

    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from(supabaseTableName)
        .update(formData)
        .eq('id', recordId)

      if (error) {
        console.error('Error saving record:', error)
        alert('Failed to save record. Please try again.')
      } else {
        onSave?.()
        onClose()
      }
    } catch (error) {
      console.error('Error saving record:', error)
      alert('Failed to save record. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function handleFieldChange(fieldName: string, value: any) {
    setFormData((prev) => ({ ...prev, [fieldName]: value }))
  }

  if (!open || !recordId) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <DialogTitle>Record Details</DialogTitle>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {tableFields
              .filter((field) => field.name !== 'id' && field.name !== 'created_at' && field.name !== 'updated_at')
              .map((field) => {
                const value = formData[field.name]

                return (
                  <FieldEditor
                    key={field.id}
                    field={field}
                    value={value}
                    onChange={(newValue) => handleFieldChange(field.name, newValue)}
                    required={field.required || false}
                  />
                )
              })}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

