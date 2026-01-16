"use client"

import { ReactNode } from 'react'
import type { TableField } from '@/types/fields'
import TextCell from './cells/TextCell'
import LongTextCell from './cells/LongTextCell'
import NumberCell from './cells/NumberCell'
import DateCell from './cells/DateCell'
import SelectCell from './cells/SelectCell'
import MultiSelectCell from './cells/MultiSelectCell'
import CheckboxCell from './cells/CheckboxCell'
import AttachmentCell from './cells/AttachmentCell'
import UrlCell from './cells/UrlCell'
import EmailCell from './cells/EmailCell'
import JsonCell from './cells/JsonCell'
import LookupCell from './cells/LookupCell'
import LinkedRecordCell from './cells/LinkedRecordCell'

interface CellFactoryProps {
  field: TableField
  value: any
  rowId: string
  tableName: string
  editable?: boolean
  wrapText?: boolean
  rowHeight?: number // Row height in pixels
  onSave: (value: any) => Promise<void>
  onFieldOptionsUpdate?: () => void // Callback when select options are updated
}

export function CellFactory({
  field,
  value,
  rowId,
  tableName,
  editable = true,
  wrapText = false,
  rowHeight,
  onSave,
  onFieldOptionsUpdate,
}: CellFactoryProps): ReactNode {
  const commonProps = {
    value,
    fieldName: field.name,
    editable,
    wrapText,
    rowHeight,
    onSave,
  }

  switch (field.type) {
    case 'text':
      return <TextCell {...commonProps} />

    case 'long_text':
      return <LongTextCell {...commonProps} />

    case 'number':
    case 'percent':
    case 'currency':
      return (
        <NumberCell
          {...commonProps}
          precision={field.options?.precision}
        />
      )

    case 'date':
      return <DateCell {...commonProps} />

    case 'single_select':
      return (
        <SelectCell
          {...commonProps}
          choices={field.options?.choices || []}
          choiceColors={field.options?.choiceColors}
          fieldOptions={field.options}
          fieldId={field.id}
          tableId={field.table_id}
          onFieldOptionsUpdate={onFieldOptionsUpdate}
        />
      )

    case 'multi_select':
      return (
        <MultiSelectCell
          {...commonProps}
          choices={field.options?.choices || []}
          choiceColors={field.options?.choiceColors}
          fieldOptions={field.options}
          fieldId={field.id}
          tableId={field.table_id}
          onFieldOptionsUpdate={onFieldOptionsUpdate}
        />
      )

    case 'checkbox':
      return <CheckboxCell {...commonProps} fieldOptions={field.options} />

    case 'attachment':
      return (
        <AttachmentCell
          {...commonProps}
          rowId={rowId}
          tableName={tableName}
          fieldOptions={field.options}
        />
      )

    case 'url':
      return <UrlCell {...commonProps} />

    case 'email':
      return <EmailCell {...commonProps} />

    case 'json':
      return <JsonCell {...commonProps} editable={false} />

    case 'link_to_table':
      return (
        <LinkedRecordCell
          value={value}
          fieldName={field.name}
          fieldOptions={field.options}
        />
      )

    case 'formula':
      // These are read-only or need special handling
      return <TextCell {...commonProps} editable={false} />

    case 'lookup':
      return (
        <LookupCell
          value={value}
          fieldName={field.name}
          field={field}
          rowId={rowId}
        />
      )

    default:
      // Fallback: try to infer type from value
      if (typeof value === 'boolean') {
        return <CheckboxCell {...commonProps} />
      }
      if (typeof value === 'number') {
        return <NumberCell {...commonProps} />
      }
      if (value && typeof value === 'string') {
        // Try to detect URL or email
        if (value.startsWith('http://') || value.startsWith('https://')) {
          return <UrlCell {...commonProps} />
        }
        if (value.includes('@') && value.includes('.')) {
          return <EmailCell {...commonProps} />
        }
        // Try to parse as date
        if (!isNaN(Date.parse(value))) {
          return <DateCell {...commonProps} />
        }
      }
      if (typeof value === 'object' && value !== null) {
        return <JsonCell {...commonProps} editable={false} />
      }
      return <TextCell {...commonProps} />
  }
}

// Helper to map Supabase column types to field types
export function inferFieldTypeFromColumn(
  columnName: string,
  columnType: string,
  value: any
): TableField['type'] {
  const lowerType = columnType.toLowerCase()
  const lowerName = columnName.toLowerCase()

  // Check for specific patterns
  if (lowerName.includes('email') || lowerName.includes('mail')) {
    return 'email'
  }
  if (lowerName.includes('url') || lowerName.includes('link') || lowerName.includes('website')) {
    return 'url'
  }
  if (lowerName.includes('attachment') || lowerName.includes('file')) {
    return 'attachment'
  }
  if (lowerName.includes('json') || lowerType.includes('jsonb')) {
    // Only return 'json' if it's explicitly a json/jsonb column, not if it's used for attachments
    if (!lowerName.includes('attachment') && !lowerName.includes('file')) {
      return 'json'
    }
  }

  // Map PostgreSQL types
  if (lowerType.includes('bool')) {
    return 'checkbox'
  }
  if (lowerType.includes('int') || lowerType.includes('numeric') || lowerType.includes('float') || lowerType.includes('decimal')) {
    return 'number'
  }
  if (lowerType.includes('date') || lowerType.includes('time')) {
    return 'date'
  }
  if (lowerType.includes('json') || lowerType.includes('jsonb')) {
    // Check if it's explicitly named as attachment/file, otherwise treat as json
    if (lowerName.includes('attachment') || lowerName.includes('file')) {
      return 'attachment'
    }
    return 'json'
  }
  if (lowerType.includes('text') || lowerType.includes('varchar') || lowerType.includes('char')) {
    // Check value to determine if it's long text
    if (value && typeof value === 'string' && value.length > 100) {
      return 'long_text'
    }
    return 'text'
  }

  return 'text' // Default fallback
}
