"use client"

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Save, Trash2 } from 'lucide-react'
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
import { useToast } from '@/components/ui/use-toast'
import { useUserRole } from '@/lib/hooks/useUserRole'
import { isAbortError } from '@/lib/api/error-handling'

export interface RecordModalProps {
  open: boolean
  onClose: () => void
  tableId: string
  recordId: string | null
  tableFields: TableField[]
  modalFields?: string[] // Fields to show in modal (if empty, show all)
  initialData?: Record<string, any> // Initial data for creating new records
  onSave?: (createdRecordId?: string | null) => void // Callback with created record ID for new records
  onDeleted?: () => void | Promise<void>
  supabaseTableName?: string | null // Optional: if provided, skips table info fetch for faster loading
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
  onDeleted,
  supabaseTableName: supabaseTableNameProp,
}: RecordModalProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [supabaseTableName, setSupabaseTableName] = useState<string | null>(supabaseTableNameProp || null)
  const { toast } = useToast()
  const { role: userRole } = useUserRole()

  // Use prop directly if available, otherwise use state
  const effectiveTableName = supabaseTableNameProp || supabaseTableName

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
        if (!isAbortError(error)) {
          console.error('Error loading table info:', error)
        }
      } else if (table) {
        setSupabaseTableName(table.supabase_table)
      }
    } catch (error) {
      if (!isAbortError(error)) {
        console.error('Error loading table info:', error)
      }
    }
  }, [tableId])

  const loadRecord = useCallback(async () => {
    if (!recordId || !effectiveTableName) return

    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from(effectiveTableName)
        .select('*')
        .eq('id', recordId)
        .single()

      if (error) {
        if (!isAbortError(error)) {
          console.error('Error loading record:', error)
        }
      } else if (data) {
        setFormData(data)
      }
    } catch (error) {
      if (!isAbortError(error)) {
        console.error('Error loading record:', error)
      }
    } finally {
      setLoading(false)
    }
  }, [recordId, effectiveTableName])

  // Update supabaseTableName when prop changes (for fallback when prop is removed)
  useEffect(() => {
    if (supabaseTableNameProp) {
      setSupabaseTableName(supabaseTableNameProp)
    }
  }, [supabaseTableNameProp])

  // Load table info when modal opens (only if not provided as prop)
  useEffect(() => {
    if (open && tableId && !supabaseTableNameProp) {
      loadTableInfo()
    } else if (!open) {
      // Reset state when modal closes
      if (!supabaseTableNameProp) {
        setSupabaseTableName(null)
      }
      setFormData({})
    }
  }, [open, tableId, supabaseTableNameProp, loadTableInfo])

  // Load record data when table name is available, or initialize with initialData for new records
  useEffect(() => {
    if (open && effectiveTableName) {
      if (recordId) {
        loadRecord()
      } else if (initialData) {
        // Initialize form data with initialData for new records
        setFormData(initialData)
      } else {
        setFormData({})
      }
    }
  }, [open, recordId, effectiveTableName, loadRecord, initialData])

  async function handleSave() {
    if (!effectiveTableName) return

    setSaving(true)
    try {
      const supabase = createClient()
      
      if (recordId) {
        // Update existing record
        const { error } = await supabase
          .from(effectiveTableName)
          .update(formData)
          .eq('id', recordId)

        if (error) {
          if (!isAbortError(error)) {
            console.error('Error saving record:', error)
            const message = (error as any)?.message || 'Unknown error'
            const code = (error as any)?.code ? ` (code: ${(error as any).code})` : ''
            alert(`Failed to save record${code}: ${message}`)
          }
          return
        }
      } else {
        // Create new record
        const { data, error } = await supabase
          .from(effectiveTableName)
          .insert(formData)
          .select()
          .single()

        if (error) {
          if (!isAbortError(error)) {
            console.error('Error creating record:', error)
            const message = (error as any)?.message || 'Unknown error'
            const code = (error as any)?.code ? ` (code: ${(error as any).code})` : ''
            alert(`Failed to create record${code}: ${message}`)
          }
          return
        }

        // Pass the created record ID to onSave callback
        const createdRecordId = data?.id || null
        onSave?.(createdRecordId)
        onClose()
        return
      }

      onSave?.()
      onClose()
    } catch (error) {
      if (!isAbortError(error)) {
        console.error('Error saving record:', error)
        alert('Failed to save record. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!recordId) return
    if (!effectiveTableName) return

    if (userRole !== 'admin') {
      toast({
        variant: 'destructive',
        title: 'Not allowed',
        description: 'Only admins can delete records here.',
      })
      return
    }

    if (!confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
      return
    }

    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from(effectiveTableName).delete().eq('id', recordId)
      if (error) throw error

      toast({
        title: 'Record deleted',
        description: 'The record has been deleted.',
      })
      await onDeleted?.()
      onClose()
    } catch (error: any) {
      if (!isAbortError(error)) {
        console.error('Error deleting record:', error)
        toast({
          variant: 'destructive',
          title: 'Failed to delete record',
          description: error?.message || 'Please try again',
        })
      }
    } finally {
      setDeleting(false)
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
                // Always exclude system fields
                if (!field || field.name === 'id' || field.name === 'created_at' || field.name === 'updated_at') {
                  return false
                }
                // If modalFields is specified and not empty, only show those fields
                if (modalFields.length > 0) {
                  return modalFields.includes(field.name)
                }
                // Otherwise show all fields
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
                    tableName={effectiveTableName || undefined}
                  />
                )
              })}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          {recordId && userRole === 'admin' && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || saving || loading}
              className="mr-auto"
              title="Delete this record"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={deleting}>
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

