"use client"

import { useState, useEffect } from 'react'
import { ArrowLeft, Save, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { TableField } from '@/types/fields'

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

  // Load table info when modal opens
  useEffect(() => {
    if (open && tableId) {
      loadTableInfo()
    } else {
      setSupabaseTableName(null)
      setFormData({})
    }
  }, [open, tableId])

  // Load record data when table name is available
  useEffect(() => {
    if (open && recordId && supabaseTableName) {
      loadRecord()
    }
  }, [open, recordId, supabaseTableName])

  async function loadTableInfo() {
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
      } else if (data) {
        setFormData(data)
      }
    } catch (error) {
      console.error('Error loading record:', error)
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

  function getInputType(field: TableField): string {
    switch (field.type) {
      case 'number':
      case 'currency':
        return 'number'
      case 'email':
        return 'email'
      case 'url':
        return 'url'
      case 'date':
        return 'date'
      case 'checkbox':
        return 'checkbox'
      default:
        return 'text'
    }
  }

  function formatValueForInput(field: TableField, value: any): string {
    if (value === null || value === undefined) return ''
    
    if (field.type === 'date' && value) {
      try {
        const date = new Date(value)
        return date.toISOString().split('T')[0]
      } catch {
        return String(value)
      }
    }
    
    return String(value)
  }

  function parseInputValue(field: TableField, value: string): any {
    if (field.type === 'number' || field.type === 'currency') {
      return value === '' ? null : Number(value)
    }
    
    if (field.type === 'checkbox') {
      return value === 'true' || value === 'on'
    }
    
    if (field.type === 'date' && value) {
      return new Date(value).toISOString()
    }
    
    return value === '' ? null : value
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
                const inputType = getInputType(field)
                const value = formData[field.name]
                const displayValue = formatValueForInput(field, value)

                if (field.type === 'checkbox') {
                  return (
                    <div key={field.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={field.id}
                        checked={value === true || value === 'true'}
                        onChange={(e) => handleFieldChange(field.name, e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor={field.id} className="text-sm font-medium">
                        {field.name}
                      </Label>
                    </div>
                  )
                }

                if (field.type === 'long_text') {
                  return (
                    <div key={field.id} className="space-y-2">
                      <Label htmlFor={field.id} className="text-sm font-medium">
                        {field.name}
                      </Label>
                      <textarea
                        id={field.id}
                        value={displayValue}
                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                        className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={4}
                      />
                    </div>
                  )
                }

                return (
                  <div key={field.id} className="space-y-2">
                    <Label htmlFor={field.id} className="text-sm font-medium">
                      {field.name}
                    </Label>
                    <Input
                      id={field.id}
                      type={inputType}
                      value={displayValue}
                      onChange={(e) => {
                        const parsedValue = parseInputValue(field, e.target.value)
                        handleFieldChange(field.name, parsedValue)
                      }}
                      className="w-full"
                    />
                  </div>
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

