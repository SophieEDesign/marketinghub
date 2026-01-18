"use client"

import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import { resolveFieldColor, normalizeHexColor } from '@/lib/field-colors'
import type { FieldOptions } from '@/types/fields'

interface CheckboxCellProps {
  value: boolean | null
  fieldName: string
  editable?: boolean
  onSave: (value: boolean) => Promise<void>
  fieldOptions?: FieldOptions
}

export default function CheckboxCell({
  value,
  fieldName,
  editable = true,
  onSave,
  fieldOptions,
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
  // Use color system for checkbox (green for checked, grey for unchecked)
  const checkboxColor = resolveFieldColor('checkbox', value, fieldOptions)
  const bgColor = checkboxColor ? normalizeHexColor(checkboxColor) : (isChecked ? '#10B981' : '#9CA3AF')

  return (
    <div
      onClick={handleToggle}
      className={`w-full h-full flex items-center justify-center cursor-pointer hover:bg-gray-50 rounded transition-colors ${
        !editable ? 'cursor-not-allowed opacity-50' : ''
      }`}
    >
      <div
        className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${
          isChecked
            ? ''
            : 'bg-white border-gray-300 hover:border-gray-400'
        }`}
        style={isChecked ? {
          backgroundColor: bgColor,
          borderColor: bgColor,
        } : {}}
      >
        {isChecked && <Check className="h-3 w-3 text-white" />}
      </div>
    </div>
  )
}
