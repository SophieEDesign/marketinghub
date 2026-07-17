/**
 * Standardized Pill/Tag Rendering API
 * 
 * Single source of truth for rendering pills/tags across the application.
 * All views should use these functions instead of custom implementations.
 */

import * as React from 'react'
import { ChoicePill, ChoicePillList } from '@/components/fields/ChoicePill'
import { resolveFieldColor } from '@/lib/field-colors'
import type { TableField, FieldOptions } from '@/types/fields'
import { cn } from '@/lib/utils'

/**
 * Pill rendering parameters
 */
export interface PillParams {
  field: TableField
  value: any
  density?: 'default' | 'compact'
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
  onRemove?: () => void
  maxWidth?: string | number
}

/**
 * Pill state information
 */
export interface PillState {
  label: string
  color: string | null
  isClickable: boolean
  isRemovable: boolean
  fieldType: string
}

/**
 * Resolve pill color for a field value
 * 
 * This is the single source of truth for pill color resolution.
 * All views should use this instead of implementing their own getPillColor functions.
 */
export function resolvePillColor(
  field: TableField,
  value: any
): string | null {
  if (!field || value === null || value === undefined || value === '') {
    return null
  }
  
  return resolveFieldColor(field.type, value, field.options)
}

/**
 * Get pill state information
 * 
 * Determines the state and properties of a pill for a given field and value.
 */
export function getPillState(
  field: TableField,
  value: any
): PillState {
  const label = String(value || '').trim()
  const color = resolvePillColor(field, value)
  
  // Determine if pill is clickable (linked fields)
  const isClickable = field.type === 'link_to_table' || field.type === 'lookup'
  
  // Determine if pill is removable (multi-select, linked fields with allow_create)
  const isRemovable = field.type === 'multi_select' || 
    (field.type === 'link_to_table' && field.options?.allow_create === true)
  
  return {
    label,
    color,
    isClickable,
    isRemovable,
    fieldType: field.type,
  }
}

/**
 * Render a single pill
 * 
 * This is the single source of truth for pill rendering.
 * All views should use this instead of custom implementations.
 */
export function renderPill(params: PillParams): React.ReactNode {
  const { field, value, density = 'default', className, style, onClick, onRemove, maxWidth } = params
  
  if (!field || value === null || value === undefined || value === '') {
    return null
  }
  
  // Handle multi-select fields
  if (field.type === 'multi_select') {
    const values = Array.isArray(value) ? value : [value]
    const labels = values
      .map(v => String(v).trim())
      .filter(v => v !== '')
    
    if (labels.length === 0) {
      return null
    }
    
    return (
      <ChoicePillList
        labels={labels}
        fieldType="multi_select"
        fieldOptions={field.options}
        density={density}
        className={className}
      />
    )
  }
  
  // Handle single-select fields
  if (field.type === 'single_select') {
    const label = String(value).trim()
    if (!label) return null
    
    return (
      <ChoicePill
        label={label}
        fieldType="single_select"
        fieldOptions={field.options}
        useSemanticColors={true}
        density={density}
        className={className}
        style={{ maxWidth, ...style }}
        onClick={onClick}
      />
    )
  }
  
  // Handle linked fields (link_to_table)
  if (field.type === 'link_to_table') {
    const label = String(value).trim()
    if (!label) return null
    
    const color = resolvePillColor(field, value)
    const bgColor = color ? `${color}1A` : '#F3F4F6'
    const borderColor = color ? `${color}33` : '#E5E7EB'
    const textColor = color || '#374151'
    
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border cursor-pointer",
          className
        )}
        style={{
          backgroundColor: bgColor,
          borderColor: borderColor,
          color: textColor,
          maxWidth,
          ...style,
        }}
        onClick={onClick}
        title={label}
      >
        {label}
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className="ml-2 hover:opacity-70"
            aria-label="Remove"
          >
            ×
          </button>
        )}
      </span>
    )
  }
  
  // Handle lookup fields (read-only, informational)
  if (field.type === 'lookup') {
    const label = String(value).trim()
    if (!label) return null
    
    const color = resolvePillColor(field, value)
    const bgColor = color ? `${color}1A` : '#F3F4F6'
    const borderColor = color ? `${color}33` : '#E5E7EB'
    const textColor = color || '#6B7280'
    
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border",
          className
        )}
        style={{
          backgroundColor: bgColor,
          borderColor: borderColor,
          color: textColor,
          maxWidth,
          ...style,
        }}
        title={label}
      >
        {label}
      </span>
    )
  }
  
  // For other field types, return null (no pill rendering)
  return null
}

/**
 * Render multiple pills for a field
 * 
 * Handles rendering multiple values (e.g., multi-select, multiple linked records).
 */
export function renderPills(
  field: TableField,
  values: any[],
  options?: {
    density?: 'default' | 'compact'
    max?: number
    className?: string
    onValueClick?: (value: any, index: number) => void
    onValueRemove?: (value: any, index: number) => void
  }
): React.ReactNode {
  if (!field || !values || values.length === 0) {
    return null
  }
  
  const { density = 'default', max, className, onValueClick, onValueRemove } = options || {}
  
  // Filter out empty values
  const validValues = values.filter(v => v !== null && v !== undefined && v !== '')
  
  if (validValues.length === 0) {
    return null
  }
  
  // Handle multi-select (use ChoicePillList)
  if (field.type === 'multi_select') {
    const labels = validValues.map(v => String(v).trim()).filter(Boolean)
    return (
      <ChoicePillList
        labels={labels}
        fieldType="multi_select"
        fieldOptions={field.options}
        max={max}
        density={density}
        className={className}
      />
    )
  }
  
  // Handle other field types (render individual pills)
  const shown = max ? validValues.slice(0, max) : validValues
  const remaining = max ? validValues.length - shown.length : 0
  
  return (
    <div className={cn("flex flex-wrap gap-2 items-start", className)}>
      {shown.map((value, index) => (
        <React.Fragment key={index}>
          {renderPill({
            field,
            value,
            density,
            onClick: onValueClick ? () => onValueClick(value, index) : undefined,
            onRemove: onValueRemove ? () => onValueRemove(value, index) : undefined,
          })}
        </React.Fragment>
      ))}
      {remaining > 0 && (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
          +{remaining}
        </span>
      )}
    </div>
  )
}

/**
 * Check if a field type supports pill rendering
 */
export function fieldSupportsPills(fieldType: string): boolean {
  return ['single_select', 'multi_select', 'link_to_table', 'lookup'].includes(fieldType)
}
