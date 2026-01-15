/**
 * Convert filter JSON to formula string
 * and vice versa for automation conditions
 */

import type { FilterTree, FilterGroup, FilterCondition, FilterOperator } from '@/lib/filters/canonical-model'
import type { TableField } from '@/types/fields'
import { normalizeFilterTree } from '@/lib/filters/canonical-model'

/**
 * Convert a filter tree to a formula string
 * 
 * Examples:
 * - {field: "Status", op: "equals", value: "Approved"} -> {Status} = "Approved"
 * - Multiple conditions with AND -> ({Field1} = "value1") AND ({Field2} > 5)
 */
export function filterTreeToFormula(
  filterTree: FilterTree,
  tableFields: TableField[]
): string {
  const normalized = normalizeFilterTree(filterTree)
  if (!normalized || normalized.children.length === 0) {
    return ''
  }

  return formatGroup(normalized, tableFields)
}

function formatGroup(group: FilterGroup, tableFields: TableField[]): string {
  if (group.children.length === 0) {
    return ''
  }

  if (group.children.length === 1) {
    return formatChild(group.children[0], tableFields)
  }

  const parts = group.children.map(child => {
    const formatted = formatChild(child, tableFields)
    return `(${formatted})`
  })

  return parts.join(` ${group.operator} `)
}

function formatChild(
  child: FilterCondition | FilterGroup,
  tableFields: TableField[]
): string {
  if ('field_id' in child) {
    // It's a condition
    return formatCondition(child, tableFields)
  } else {
    // It's a nested group
    return formatGroup(child, tableFields)
  }
}

function formatCondition(
  condition: FilterCondition,
  tableFields: TableField[]
): string {
  const fieldName = condition.field_id
  const field = tableFields.find(f => f.name === fieldName || f.id === fieldName)
  const fieldRef = `{${fieldName}}`

  switch (condition.operator) {
    case 'equal':
      return formatValueComparison(fieldRef, '=', condition.value, field)
    
    case 'not_equal':
      return formatValueComparison(fieldRef, '≠', condition.value, field)
    
    case 'contains':
      return `FIND("${escapeString(String(condition.value ?? ''))}", ${fieldRef}) > 0`
    
    case 'not_contains':
      return `FIND("${escapeString(String(condition.value ?? ''))}", ${fieldRef}) = 0`
    
    case 'is_empty':
      return `ISBLANK(${fieldRef})`
    
    case 'is_not_empty':
      return `NOT(ISBLANK(${fieldRef}))`
    
    case 'greater_than':
      return formatValueComparison(fieldRef, '>', condition.value, field)
    
    case 'less_than':
      return formatValueComparison(fieldRef, '<', condition.value, field)
    
    case 'greater_than_or_equal':
      return formatValueComparison(fieldRef, '>=', condition.value, field)
    
    case 'less_than_or_equal':
      return formatValueComparison(fieldRef, '<=', condition.value, field)
    
    case 'date_equal':
      return formatValueComparison(fieldRef, '=', condition.value, field)
    
    case 'date_before':
      return formatValueComparison(fieldRef, '<', condition.value, field)
    
    case 'date_after':
      return formatValueComparison(fieldRef, '>', condition.value, field)
    
    case 'date_on_or_before':
      return formatValueComparison(fieldRef, '<=', condition.value, field)
    
    case 'date_on_or_after':
      return formatValueComparison(fieldRef, '>=', condition.value, field)
    
    default:
      return `${fieldRef} = ${formatValue(condition.value, field)}`
  }
}

function formatValueComparison(
  fieldRef: string,
  operator: string,
  value: any,
  field: TableField | undefined
): string {
  return `${fieldRef} ${operator} ${formatValue(value, field)}`
}

function formatValue(value: any, field: TableField | undefined): string {
  if (value === null || value === undefined) {
    return '""'
  }

  // Boolean values
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE'
  }

  // Number values
  if (typeof value === 'number') {
    return String(value)
  }

  // String values - always quote
  return `"${escapeString(String(value))}"`
}

function escapeString(str: string): string {
  return str.replace(/"/g, '""').replace(/\n/g, '\\n').replace(/\r/g, '\\r')
}

/**
 * Generate a human-readable summary of conditions
 * 
 * Example: "When a Briefing is created AND Status is Approved AND Owner is not empty"
 */
export function generateConditionSummary(
  filterTree: FilterTree,
  tableFields: TableField[],
  tableName?: string
): string {
  const normalized = normalizeFilterTree(filterTree)
  if (!normalized || normalized.children.length === 0) {
    return 'Run every time'
  }

  const parts: string[] = []
  
  if (tableName) {
    parts.push(`When a ${tableName} is created`)
  }

  const conditionParts = formatGroupSummary(normalized, tableFields)
  if (conditionParts) {
    parts.push(conditionParts)
  }

  return parts.length > 0 ? parts.join(' AND ') : 'Run every time'
}

function formatGroupSummary(
  group: FilterGroup,
  tableFields: TableField[]
): string {
  if (group.children.length === 0) {
    return ''
  }

  const parts = group.children.map(child => {
    if ('field_id' in child) {
      return formatConditionSummary(child, tableFields)
    } else {
      return `(${formatGroupSummary(child, tableFields)})`
    }
  })

  return parts.join(` ${group.operator} `)
}

function formatConditionSummary(
  condition: FilterCondition,
  tableFields: TableField[]
): string {
  const fieldName = condition.field_id
  const field = tableFields.find(f => f.name === fieldName || f.id === fieldName)

  const operatorLabels: Record<FilterOperator, string> = {
    equal: 'is',
    not_equal: 'is not',
    contains: 'contains',
    not_contains: 'does not contain',
    is_empty: 'is empty',
    is_not_empty: 'is not empty',
    greater_than: 'is greater than',
    less_than: 'is less than',
    greater_than_or_equal: 'is greater than or equal to',
    less_than_or_equal: 'is less than or equal to',
    date_equal: 'is',
    date_before: 'is before',
    date_after: 'is after',
    date_on_or_before: 'is on or before',
    date_on_or_after: 'is on or after',
    date_range: 'is within',
    has: 'has',
    does_not_have: 'does not have',
  }

  const operatorLabel = operatorLabels[condition.operator] || condition.operator
  const valueLabel = formatValueSummary(condition.value, field)

  if (['is_empty', 'is_not_empty'].includes(condition.operator)) {
    return `${fieldName} ${operatorLabel}`
  }

  return `${fieldName} ${operatorLabel} ${valueLabel}`
}

function formatValueSummary(value: any, field: TableField | undefined): string {
  if (value === null || value === undefined) {
    return 'empty'
  }

  if (typeof value === 'boolean') {
    return value ? 'checked' : 'unchecked'
  }

  return String(value)
}
