"use client"

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import RichTextEditor from '@/components/fields/RichTextEditor'
import { Button } from '@/components/ui/button'

interface TextCellModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string | null
  fieldName: string
  onSave: (value: string) => Promise<void>
  isLongText?: boolean
}

export default function TextCellModal({
  open,
  onOpenChange,
  value,
  fieldName,
  onSave,
  isLongText = false,
}: TextCellModalProps) {
  const [editValue, setEditValue] = useState(value || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setEditValue(value || '')
  }, [value, open])

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      await onSave(editValue)
      onOpenChange(false)
    } catch (error: any) {
      console.error('Error saving text cell:', error)
      alert(error?.message || 'Failed to save. Please check your permissions and try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditValue(value || '')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">
            Edit {fieldName}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {isLongText ? (
            <div className="flex-1 overflow-auto min-h-0">
              <RichTextEditor
                value={editValue}
                onChange={setEditValue}
                editable={true}
                showToolbar={true}
                minHeight="400px"
                className="w-full"
              />
            </div>
          ) : (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full flex-1 min-h-[300px] px-4 py-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 resize-none"
              placeholder="Enter text..."
              disabled={saving}
            />
          )}
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
