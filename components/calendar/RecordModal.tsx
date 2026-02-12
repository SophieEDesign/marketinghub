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
  modalFields?: string[] // Fields to show in modal (if undefined, show all; if empty array, show none; if has values, show only those)
  onSave?: () => void
  initialData?: Record<string, any> // Initial data for creating new records (e.g., pre-filled date)
}

export default function RecordModal({
  open,
  onClose,
  tableId,
  recordId,
  tableFields,
  modalFields,
  onSave,
  initialData,
}: RecordModalProps) {
  // #region agent log
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const linkToTableFields = tableFields.filter(f => f.type === 'link_to_table' || f.type === 'lookup')
      const visibleFields = tableFields.filter((field) => {
        if (field.name === 'id' || field.name === 'created_at' || field.name === 'updated_at') {
          return false
        }
        if (modalFields === undefined) {
          return true
        }
        if (Array.isArray(modalFields)) {
          return modalFields.includes(field.name)
        }
        return true
      })
      const visibleLinkToTableFields = visibleFields.filter(f => f.type === 'link_to_table' || f.type === 'lookup')
      
      fetch('http://127.0.0.1:7242/ingest/7e9b68cb-9457-4ad2-a6ab-af4806759e7a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `log_${Date.now()}_calendar_recordmodal_render`,
          runId: 'pre-fix-3',
          hypothesisId: 'H1',
          location: 'RecordModal.tsx:render',
          message: 'Calendar RecordModal render',
          data: {
            open,
            tableId,
            recordId,
            tableFieldsLength: tableFields.length,
            modalFieldsLength: modalFields?.length ?? null,
            linkToTableFieldsCount: linkToTableFields.length,
            visibleFieldsCount: visibleFields.length,
            visibleLinkToTableFieldsCount: visibleLinkToTableFields.length,
          },
          timestamp: Date.now()
        })
      }).catch(() => {})
    }
  }, [open, tableId, recordId, tableFields.length, modalFields?.length])
  // #endregion

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

  // Load record data after table info is loaded, or initialize with initialData for new records
  useEffect(() => {
    if (open && recordId && supabaseTableName) {
      loadRecord()
    } else if (open && !recordId && initialData) {
      // For new records, initialize with initialData
      setFormData(initialData)
    } else {
      setFormData({})
    }
  }, [open, recordId, supabaseTableName, initialData])

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
          .insert([formData])

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

  const isNewRecord = !recordId

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
            <DialogTitle>{isNewRecord ? 'Create New Record' : 'Record Details'}</DialogTitle>
          </div>
        </DialogHeader>

        {loading && recordId ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {tableFields
              .filter((field) => {
                // Always exclude system fields
                if (field.name === 'id' || field.name === 'created_at' || field.name === 'updated_at') {
                  return false
                }
                // If modalFields is undefined, show all fields (not configured yet)
                if (modalFields === undefined) {
                  return true
                }
                // If modalFields is provided (array), only show fields in the array
                // Empty array means user configured to show none, array with values means show only those
                if (Array.isArray(modalFields)) {
                  return modalFields.includes(field.name)
                }
                // Fallback: show all if modalFields is not an array
                return true
              })
              .map((field) => {
                const value = formData[field.name]

                // #region agent log - FieldEditor rendered
                if (typeof window !== 'undefined' && (field.type === 'link_to_table' || field.type === 'lookup')) {
                  fetch('http://127.0.0.1:7242/ingest/7e9b68cb-9457-4ad2-a6ab-af4806759e7a', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      id: `log_${Date.now()}_recordmodal_fieldeditor_${field.id}`,
                      runId: 'pre-fix-3',
                      hypothesisId: 'H1',
                      location: 'RecordModal.tsx:FieldEditor.map',
                      message: 'FieldEditor rendered for link_to_table/lookup field',
                      data: {
                        fieldId: field.id,
                        fieldName: field.name,
                        fieldType: field.type,
                        hasValue: value !== null && value !== undefined,
                        valueIsArray: Array.isArray(value),
                        valueLength: Array.isArray(value) ? value.length : (value ? 1 : 0),
                      },
                      timestamp: Date.now()
                    })
                  }).catch(() => {});
                }
                // #endregion

                return (
                  <FieldEditor
                    key={field.id}
                    field={field}
                    value={value}
                    onChange={(newValue) => handleFieldChange(field.name, newValue)}
                    required={field.required || false}
                    recordId={recordId || undefined}
                    tableName={supabaseTableName || undefined}
                  />
                )
              })}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || (loading && recordId)}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? (isNewRecord ? 'Creating...' : 'Saving...') : (isNewRecord ? 'Create' : 'Save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

