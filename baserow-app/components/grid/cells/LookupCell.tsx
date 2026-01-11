"use client"

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRecordPanel } from '@/contexts/RecordPanelContext'
import { ExternalLink } from 'lucide-react'

interface LookupCellProps {
  value: string | null | any | Array<string | { id: string; value: string }>
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

interface LookupPillProps {
  item: string | { id: string; value: string }
  lookupTableId: string
  lookupFieldId: string
  onOpenRecord: (tableId: string, recordId: string, tableName: string) => void
}

function LookupPill({ item, lookupTableId, lookupFieldId, onOpenRecord }: LookupPillProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Extract ID and display value
  // Future-proof: handle { id, value } structure
  const hasId = typeof item === 'object' && item !== null && 'id' in item
  const recordId = hasId ? (item as { id: string; value: string }).id : null
  const displayValue = hasId 
    ? (item as { id: string; value: string }).value 
    : (typeof item === 'string' ? item : String(item))

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent cell selection
    
    if (!lookupTableId || !lookupFieldId) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      
      // If we have an ID, use it directly (preferred path)
      if (recordId) {
        // Get the lookup table info
        const { data: lookupTable, error: tableError } = await supabase
          .from('tables')
          .select('id, name, supabase_table')
          .eq('id', lookupTableId)
          .single()

        if (tableError || !lookupTable) {
          console.error('Error loading lookup table:', tableError)
          setError('Failed to load table')
          return
        }

        // Open the record directly using the ID
        onOpenRecord(lookupTable.id, recordId, lookupTable.supabase_table)
        return
      }

      // Fallback: search by value (current implementation)
      // Get the lookup table info
      const { data: lookupTable, error: tableError } = await supabase
        .from('tables')
        .select('id, name, supabase_table')
        .eq('id', lookupTableId)
        .single()

      if (tableError || !lookupTable) {
        console.error('Error loading lookup table:', tableError)
        setError('Failed to load table')
        return
      }

      // Get the lookup field info to find the field name
      const { data: lookupField, error: fieldError } = await supabase
        .from('table_fields')
        .select('name')
        .eq('id', lookupFieldId)
        .single()

      if (fieldError || !lookupField) {
        console.error('Error loading lookup field:', fieldError)
        setError('Failed to load field')
        return
      }

      // Search for the record in the lookup table that matches the value
      // Use type assertion to avoid TypeScript's "excessively deep" error with dynamic table names
      const tableName = lookupTable.supabase_table as string
      const { data: records, error: searchError } = await (supabase
        .from(tableName)
        .select('id')
        .eq(lookupField.name, displayValue)
        .limit(1) as any)

      if (searchError) {
        console.error('Error searching for record:', searchError)
        setError('Failed to find record')
        return
      }

      if (records && records.length > 0) {
        // Open the record in the record panel
        onOpenRecord(lookupTable.id, records[0].id, lookupTable.supabase_table)
      } else {
        // If we can't find the record, navigate to the table
        console.warn('Could not find record with matching value, navigating to table instead')
        window.location.href = `/tables/${lookupTable.id}`
      }
    } catch (err) {
      console.error('Error opening lookup record:', err)
      setError('Failed to open record')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      title="Open record"
      aria-label={`Open record: ${displayValue}`}
    >
      <span>{displayValue}</span>
      {loading ? (
        <span className="h-3 w-3 border-2 border-blue-800 border-t-transparent rounded-full animate-spin" />
      ) : (
        <ExternalLink className="h-3 w-3 opacity-60" />
      )}
      {error && (
        <span className="text-red-600 text-xs" title={error}>⚠</span>
      )}
    </button>
  )
}

export default function LookupCell({
  value,
  fieldName,
  field,
  rowId,
  placeholder = '—',
}: LookupCellProps) {
  const { openRecord } = useRecordPanel()

  if (!value) {
    return (
      <div className="w-full h-full px-2 flex items-center text-sm text-gray-400">
        {placeholder}
      </div>
    )
  }

  // Handle multi-value lookups (arrays)
  const values = Array.isArray(value) ? value : [value]

  // Filter out null/undefined values
  const validValues = values.filter(v => v !== null && v !== undefined)

  if (validValues.length === 0) {
    return (
      <div className="w-full h-full px-2 flex items-center text-sm text-gray-400">
        {placeholder}
      </div>
    )
  }

  // Type guard: ensure lookup config exists
  const lookupTableId = field.options?.lookup_table_id
  const lookupFieldId = field.options?.lookup_field_id

  if (!lookupTableId || !lookupFieldId) {
    // If lookup config is missing, just display the value(s)
    return (
      <div className="w-full h-full px-2 flex items-center gap-1 flex-wrap">
        {validValues.map((item, index) => {
          const displayValue = typeof item === 'string' 
            ? item 
            : (typeof item === 'object' && item !== null && 'value' in item 
              ? (item as { value: string }).value 
              : String(item))
          return (
            <span 
              key={index}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
            >
              {displayValue}
            </span>
          )
        })}
      </div>
    )
  }

  return (
    <div className="w-full h-full px-2 flex items-center gap-1 flex-wrap">
      {validValues.map((item, index) => (
        <LookupPill
          key={index}
          item={item}
          lookupTableId={lookupTableId}
          lookupFieldId={lookupFieldId}
          onOpenRecord={openRecord}
        />
      ))}
    </div>
  )
}
