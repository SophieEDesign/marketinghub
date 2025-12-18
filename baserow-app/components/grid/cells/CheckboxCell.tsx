"use client"

import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'

interface CheckboxCellProps {
  value: boolean | null
  fieldName: string
  editable?: boolean
  onSave: (value: boolean) => Promise<void>
}

export default function CheckboxCell({
  value,
  fieldName,
  editable = true,
  onSave,
}: CheckboxCellProps) {
  const [saving, setSaving] = useState(false)

  const handleToggle = async () => {
    if (!editable || saving) return
    setSaving(true)
    try {
      await onSave(!value)
    } catch (error) {
      console.error('Error saving checkbox cell:', error)
    } finally {
      setSaving(false)
    }
  }

  const isChecked = value === true

  return (
    <div
      onClick={handleToggle}
      className={`w-full h-full flex items-center justify-center cursor-pointer hover:bg-blue-50 rounded transition-colors ${
        !editable ? 'cursor-not-allowed opacity-50' : ''
      }`}
    >
      <div
        className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${
          isChecked
            ? 'bg-blue-600 border-blue-600'
            : 'bg-white border-gray-300 hover:border-blue-500'
        }`}
      >
        {isChecked && <Check className="h-3 w-3 text-white" />}
      </div>
    </div>
  )
}
