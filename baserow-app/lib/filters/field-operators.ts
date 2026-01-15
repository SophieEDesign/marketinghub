/**
 * Field-Aware Filter Operators
 * 
 * Defines which operators are available for each field type.
 * This ensures consistent, predictable filter behavior across the entire application.
 */

import type { TableField } from '@/types/fields'
import type { FilterOperator } from './canonical-model'

export interface OperatorOption {
  value: FilterOperator
  label: string
  requiresValue: boolean
  supportsMultiValue?: boolean // For "is any of" / "is none of" operators
}

/**
 * Get available operators for a field type
 */
export function getOperatorsForFieldType(fieldType: string): OperatorOption[] {
  switch (fieldType) {
    case 'text':
    case 'long_text':
      return [
        { value: 'contains', label: 'Contains', requiresValue: true },
        { value: 'not_contains', label: 'Does not contain', requiresValue: true },
        { value: 'equal', label: 'Is exactly', requiresValue: true },
        { value: 'not_equal', label: 'Is not exactly', requiresValue: true },
        { value: 'is_empty', label: 'Is empty', requiresValue: false },
        { value: 'is_not_empty', label: 'Is not empty', requiresValue: false },
      ]

    case 'number':
    case 'currency':
    case 'percent':
      return [
        { value: 'equal', label: 'Equals', requiresValue: true },
        { value: 'not_equal', label: 'Does not equal', requiresValue: true },
        { value: 'greater_than', label: 'Greater than', requiresValue: true },
        { value: 'greater_than_or_equal', label: 'Greater than or equal', requiresValue: true },
        { value: 'less_than', label: 'Less than', requiresValue: true },
        { value: 'less_than_or_equal', label: 'Less than or equal', requiresValue: true },
        { value: 'is_empty', label: 'Is empty', requiresValue: false },
        { value: 'is_not_empty', label: 'Is not empty', requiresValue: false },
      ]

    case 'date':
      return [
        { value: 'date_equal', label: 'Is', requiresValue: true },
        { value: 'date_before', label: 'Before', requiresValue: true },
        { value: 'date_after', label: 'After', requiresValue: true },
        { value: 'date_today', label: 'Today', requiresValue: false },
        { value: 'date_next_days', label: 'Next X days', requiresValue: true },
        { value: 'date_on_or_before', label: 'On or before', requiresValue: true },
        { value: 'date_on_or_after', label: 'On or after', requiresValue: true },
        { value: 'date_range', label: 'Is within', requiresValue: true },
        { value: 'is_empty', label: 'Is empty', requiresValue: false },
        { value: 'is_not_empty', label: 'Is not empty', requiresValue: false },
      ]

    case 'single_select':
      return [
        { value: 'equal', label: 'Is', requiresValue: true },
        { value: 'not_equal', label: 'Is not', requiresValue: true },
        { value: 'is_empty', label: 'Is empty', requiresValue: false },
        { value: 'is_not_empty', label: 'Is not empty', requiresValue: false },
      ]

    case 'multi_select':
      return [
        { value: 'equal', label: 'Contains', requiresValue: true },
        { value: 'not_equal', label: 'Does not contain', requiresValue: true },
        { value: 'is_empty', label: 'Is empty', requiresValue: false },
        { value: 'is_not_empty', label: 'Is not empty', requiresValue: false },
      ]

    case 'checkbox':
      return [
        { value: 'equal', label: 'Is checked', requiresValue: true },
        { value: 'not_equal', label: 'Is unchecked', requiresValue: true },
      ]

    case 'link_to_table':
      return [
        { value: 'is_empty', label: 'Has no linked records', requiresValue: false },
        { value: 'is_not_empty', label: 'Has linked records', requiresValue: false },
        { value: 'has', label: 'Has record matching...', requiresValue: true },
        { value: 'does_not_have', label: 'Does not have record matching...', requiresValue: true },
      ]

    case 'lookup':
      // Lookup fields are read-only but filterable
      // Operators depend on the underlying field type being looked up
      // For now, provide basic operators
      return [
        { value: 'equal', label: 'Is', requiresValue: true },
        { value: 'not_equal', label: 'Is not', requiresValue: true },
        { value: 'contains', label: 'Contains', requiresValue: true },
        { value: 'not_contains', label: 'Does not contain', requiresValue: true },
        { value: 'is_empty', label: 'Is empty', requiresValue: false },
        { value: 'is_not_empty', label: 'Is not empty', requiresValue: false },
      ]

    case 'formula':
      // Formula fields are read-only but filterable
      // Operators depend on the formula return type
      return [
        { value: 'equal', label: 'Is', requiresValue: true },
        { value: 'not_equal', label: 'Is not', requiresValue: true },
        { value: 'is_empty', label: 'Is empty', requiresValue: false },
        { value: 'is_not_empty', label: 'Is not empty', requiresValue: false },
      ]

    default:
      // Fallback for unknown field types
      return [
        { value: 'equal', label: 'Equals', requiresValue: true },
        { value: 'not_equal', label: 'Does not equal', requiresValue: true },
        { value: 'is_empty', label: 'Is empty', requiresValue: false },
        { value: 'is_not_empty', label: 'Is not empty', requiresValue: false },
      ]
  }
}

/**
 * Check if an operator is valid for a field type
 */
export function isOperatorValidForField(fieldType: string, operator: FilterOperator): boolean {
  const operators = getOperatorsForFieldType(fieldType)
  return operators.some(op => op.value === operator)
}

/**
 * Get the default operator for a field type
 */
export function getDefaultOperatorForFieldType(fieldType: string): FilterOperator {
  const operators = getOperatorsForFieldType(fieldType)
  return operators[0]?.value || 'equal'
}

/**
 * Check if a field can be filtered
 */
export function isFieldFilterable(field: TableField): boolean {
  // All fields are filterable except certain virtual fields
  // Formula and lookup fields are filterable (read-only but can be filtered)
  return true
}
