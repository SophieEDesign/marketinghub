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
  rowHeight?: number
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
      
      // Cast supabase client to any to break the type chain and prevent deep type instantiation
      type QueryResult = { data: Array<{ id: string }> | null; error: any }
      const result = await ((supabase as any)
        .from(tableName)
        .select('id')
        .eq(lookupField.name, displayValue)
        .limit(1)) as QueryResult
      const { data: records, error: searchError } = result

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
      onDoubleClick={(e) => e.stopPropagation()}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-gray-200"
      title="Click to open record"
      aria-label={`Open record: ${displayValue}`}
    >
      <span>{displayValue}</span>
      {loading ? (
        <span className="h-3 w-3 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
      ) : (
        <ExternalLink className="h-3 w-3 text-gray-500 opacity-70" />
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
  rowHeight,
  placeholder = '—',
}: LookupCellProps) {
  const { openRecord } = useRecordPanel()
  const containerStyle: React.CSSProperties = rowHeight ? { height: `${rowHeight}px` } : {}

  if (!value) {
    return (
      <div className="w-full h-full px-3 flex items-center text-sm text-gray-400 italic overflow-hidden" style={containerStyle}>
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
      <div className="w-full h-full px-3 flex items-center text-sm text-gray-400 italic overflow-hidden" style={containerStyle}>
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
      <div className="w-full h-full px-3 flex items-center gap-1.5 flex-wrap overflow-hidden" style={containerStyle}>
        {validValues.map((item, index) => {
          const displayValue = typeof item === 'string' 
            ? item 
            : (typeof item === 'object' && item !== null && 'value' in item 
              ? (item as { value: string }).value 
              : String(item))
          return (
            <span 
              key={index}
              className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700"
              style={{ boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)' }}
            >
              {displayValue}
            </span>
          )
        })}
      </div>
    )
  }

  return (
    <div 
      className="w-full h-full px-3 flex items-center gap-1.5 flex-wrap overflow-hidden"
      style={containerStyle}
      onClick={(e) => {
        // Prevent cell selection when clicking pills
        e.stopPropagation()
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
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
