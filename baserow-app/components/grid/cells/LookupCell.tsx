"use client"

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRecordPanel } from '@/contexts/RecordPanelContext'
import { ExternalLink } from 'lucide-react'

interface LookupCellProps {
  value: string | null | any
  fieldName: string
  field: {
    type: string
    options?: {
      lookup_table_id?: string
      lookup_field_id?: string
    }
  }
  rowId: string
  placeholder?: string
}

export default function LookupCell({
  value,
  fieldName,
  field,
  rowId,
  placeholder = '—',
}: LookupCellProps) {
  const { openRecord } = useRecordPanel()
  const [loading, setLoading] = useState(false)

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent cell selection
    
    if (!value || !field.options?.lookup_table_id || !field.options?.lookup_field_id) {
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      
      // Get the lookup table info
      const { data: lookupTable, error: tableError } = await supabase
        .from('tables')
        .select('id, name, supabase_table')
        .eq('id', field.options.lookup_table_id)
        .single()

      if (tableError || !lookupTable) {
        console.error('Error loading lookup table:', tableError)
        return
      }

      // Get the lookup field info to find the field name
      const { data: lookupField, error: fieldError } = await supabase
        .from('table_fields')
        .select('name')
        .eq('id', field.options.lookup_field_id)
        .single()

      if (fieldError || !lookupField) {
        console.error('Error loading lookup field:', fieldError)
        return
      }

      // Extract the display value (handle both string and object values)
      const displayValue = typeof value === 'string' ? value : (value?.value || value?.name || String(value))
      
      // Search for the record in the lookup table that matches the value
      const { data: records, error: searchError } = await supabase
        .from(lookupTable.supabase_table)
        .select('id')
        .eq(lookupField.name, displayValue)
        .limit(1)

      if (searchError) {
        console.error('Error searching for record:', searchError)
        return
      }

      if (records && records.length > 0) {
        // Open the record in the record panel
        openRecord(lookupTable.id, records[0].id, lookupTable.supabase_table)
      } else {
        // If we can't find the record, still try to navigate to the table
        // This is a fallback - ideally we'd have the record ID stored
        console.warn('Could not find record with matching value, navigating to table instead')
        window.location.href = `/tables/${lookupTable.id}`
      }
    } catch (error) {
      console.error('Error opening lookup record:', error)
    } finally {
      setLoading(false)
    }
  }

  // Extract display value (handle both string and object values)
  const displayValue = value 
    ? (typeof value === 'string' ? value : (value?.value || value?.name || String(value)))
    : null

  if (!displayValue) {
    return (
      <div className="w-full h-full px-2 flex items-center text-sm text-gray-400">
        {placeholder}
      </div>
    )
  }

  return (
    <div className="w-full h-full px-2 flex items-center gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        title={`Click to open record: ${displayValue}`}
      >
        <span>{displayValue}</span>
        <ExternalLink className="h-3 w-3 opacity-60" />
      </button>
    </div>
  )
}
