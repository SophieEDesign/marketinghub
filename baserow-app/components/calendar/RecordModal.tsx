"use client"

import { useState, useEffect, useCallback } from 'react'
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

export interface RecordModalProps {
  open: boolean
  onClose: () => void
  tableId: string
  recordId: string | null
  tableFields: TableField[]
  modalFields?: string[] // Fields to show in modal (if empty, show all)
  initialData?: Record<string, any> // Initial data for creating new records
  onSave?: () => void
}

export default function RecordModal({
  open,
  onClose,
  tableId,
  recordId,
  tableFields,
  modalFields = [],
  initialData,
  onSave,
}: RecordModalProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [supabaseTableName, setSupabaseTableName] = useState<string | null>(null)

  const loadTableInfo = useCallback(async () => {
    if (!tableId) return
    
    try {
      const supabase = createClient()
      // Sanitize tableId (remove any suffix after colon)
      const sanitizedTableId = tableId.split(':')[0]
      const { data: table, error } = await supabase
        .from('tables')
        .select('supabase_table')
        .eq('id', sanitizedTableId)
        .single()
      
      if (error) {
        console.error('Error loading table info:', error)
      } else if (table) {
        setSupabaseTableName(table.supabase_table)
      }
    } catch (error) {
      console.error('Error loading table info:', error)
    }
  }, [tableId])

  const loadRecord = useCallback(async () => {
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
      } else if (data) {
        setFormData(data)
      }
    } catch (error) {
      console.error('Error loading record:', error)
    } finally {
      setLoading(false)
    }
  }, [recordId, supabaseTableName])

  // Load table info when modal opens
  useEffect(() => {
    if (open && tableId) {
      loadTableInfo()
    } else {
      setSupabaseTableName(null)
      setFormData({})
    }
  }, [open, tableId, loadTableInfo])

  // Load record data when table name is available, or initialize with initialData for new records
  useEffect(() => {
    if (open && supabaseTableName) {
      if (recordId) {
        loadRecord()
      } else if (initialData) {
        // Initialize form data with initialData for new records
        setFormData(initialData)
      } else {
        setFormData({})
      }
    }
  }, [open, recordId, supabaseTableName, loadRecord, initialData])

  async function handleSave() {
    if (!supabaseTableName) return

    setSaving(true)
    try {
      const supabase = createClient()
      
      if (recordId) {
        // Update existing record
        const { error } = await supabase
          .from(supabaseTableName)
          .update(formData)
          .eq('id', recordId)

        if (error) {
          console.error('Error saving record:', error)
          alert('Failed to save record. Please try again.')
          return
        }
      } else {
        // Create new record
        const { error } = await supabase
          .from(supabaseTableName)
          .insert(formData)

        if (error) {
          console.error('Error creating record:', error)
          alert('Failed to create record. Please try again.')
          return
        }
      }

      onSave?.()
      onClose()
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

  if (!open) return null

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
            <DialogTitle>{recordId ? 'Record Details' : 'Create New Record'}</DialogTitle>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {Array.isArray(tableFields) && tableFields
              .filter((field) => {
                // Always exclude internal id
                if (!field || field.name === 'id') {
                  return false
                }
                // If modalFields is specified and not empty, only show those fields
                if (modalFields.length > 0) {
                  return modalFields.includes(field.name)
                }
                // Otherwise show all fields (including system fields)
                return true
              })
              .map((field) => {
                const value = formData[field.name]

                return (
                  <FieldEditor
                    key={field.id}
                    field={field}
                    value={value}
                    onChange={(newValue) => handleFieldChange(field.name, newValue)}
                    required={field.required || false}
                    recordId={recordId || undefined}
                    tableName={supabaseTableName || undefined}
                    selectOptionsEditable={false}
                    suppressDerivedFieldErrors={true}
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

