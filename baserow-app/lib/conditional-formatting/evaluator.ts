/**
 * Conditional Formatting Evaluation Engine
 * 
 * This is the shared evaluation engine for conditional formatting rules.
 * All conditional formatting evaluation must go through this engine to ensure consistency.
 * 
 * This engine evaluates highlight rules against row data to determine if formatting should apply.
 * Reuses filter evaluation logic for consistency.
 */

import type { HighlightRule } from '@/lib/interface/types'
import type { TableField } from '@/types/fields'
import { resolveDateOnlyDynamicValue, isDateOnlyString, getLocalDayBoundsFromDateOnly, toDateOnlyLocal } from '@/lib/filters/evaluation'

/**
 * Convert a value to a Date object, handling various input formats
 */
function asDate(v: any): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v
  if (!v) return null
  const d = new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Get today's date as a date-only string (YYYY-MM-DD) in local timezone
 */
function getTodayDateOnly(): string {
  return toDateOnlyLocal(new Date())
}

/**
 * Evaluate a single highlight rule against a row
 * Returns true if the rule matches, false otherwise
 */
export function evaluateHighlightRule(
  rule: HighlightRule,
  row: Record<string, any>,
  tableFields: TableField[]
): boolean {
  const { field, operator, value } = rule
  
  // Find the field definition
  const fieldDef = tableFields.find(f => f.name === field || f.id === field)
  if (!fieldDef) {
    return false // Field not found, rule doesn't match
  }
  
  // Get the field value from the row
  const fieldValue = row[field] ?? row[fieldDef.name]
  
  // Resolve dynamic date values (like '__TODAY__')
  const resolvedValue = resolveDateOnlyDynamicValue(value)
  
  // Evaluate based on operator
  switch (operator) {
    case 'eq':
      return String(fieldValue) === String(resolvedValue)
    
    case 'neq':
      return String(fieldValue) !== String(resolvedValue)
    
    case 'gt':
      return Number(fieldValue) > Number(resolvedValue)
    
    case 'lt':
      return Number(fieldValue) < Number(resolvedValue)
    
    case 'contains':
      return String(fieldValue || '').toLowerCase().includes(String(resolvedValue || '').toLowerCase())
    
    case 'is_empty':
      // Handle different field types
      if (fieldDef.type === 'multi_select') {
        return !fieldValue || (Array.isArray(fieldValue) && fieldValue.length === 0)
      }
      return fieldValue === null || fieldValue === undefined || fieldValue === ''
    
    case 'is_not_empty':
      // Handle different field types
      if (fieldDef.type === 'multi_select') {
        return fieldValue && Array.isArray(fieldValue) && fieldValue.length > 0
      }
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== ''
    
    case 'date_before':
      if (isDateOnlyString(resolvedValue)) {
        const bounds = getLocalDayBoundsFromDateOnly(resolvedValue)
        const d = asDate(fieldValue)
        if (bounds && d) {
          return d < new Date(bounds.startIso)
        }
      }
      const fieldDate = asDate(fieldValue)
      const compareDate = asDate(resolvedValue)
      if (fieldDate && compareDate) {
        return fieldDate < compareDate
      }
      return false
    
    case 'date_after':
      if (isDateOnlyString(resolvedValue)) {
        const bounds = getLocalDayBoundsFromDateOnly(resolvedValue)
        const d = asDate(fieldValue)
        if (bounds && d) {
          return d >= new Date(bounds.nextDayStartIso)
        }
      }
      const fieldDateAfter = asDate(fieldValue)
      const compareDateAfter = asDate(resolvedValue)
      if (fieldDateAfter && compareDateAfter) {
        return fieldDateAfter > compareDateAfter
      }
      return false
    
    case 'date_today':
      const today = getTodayDateOnly()
      const bounds = getLocalDayBoundsFromDateOnly(today)
      const fieldDateToday = asDate(fieldValue)
      if (bounds && fieldDateToday) {
        const start = new Date(bounds.startIso)
        const end = new Date(bounds.nextDayStartIso)
        return fieldDateToday >= start && fieldDateToday < end
      }
      return false
    
    case 'date_overdue':
      // Overdue = date is in the past (before today)
      const todayOverdue = getTodayDateOnly()
      const boundsOverdue = getLocalDayBoundsFromDateOnly(todayOverdue)
      const fieldDateOverdue = asDate(fieldValue)
      if (boundsOverdue && fieldDateOverdue) {
        return fieldDateOverdue < new Date(boundsOverdue.startIso)
      }
      return false
    
    default:
      return false
  }
}

/**
 * Evaluate multiple highlight rules against a row
 * Returns the first matching rule, or null if no rules match
 * Rules are evaluated in order, so priority is determined by array order
 */
export function evaluateHighlightRules(
  rules: HighlightRule[],
  row: Record<string, any>,
  tableFields: TableField[]
): HighlightRule | null {
  if (!rules || rules.length === 0) {
    return null
  }
  
  // Evaluate rules in order, return first match
  for (const rule of rules) {
    if (evaluateHighlightRule(rule, row, tableFields)) {
      return rule
    }
  }
  
  return null
}

/**
 * Get CSS style object from a highlight rule
 * Returns CSS style object with background and text colors
 */
export function getFormattingStyle(rule: HighlightRule): { backgroundColor?: string; color?: string } {
  const style: { backgroundColor?: string; color?: string } = {}
  
  if (rule.background_color) {
    style.backgroundColor = rule.background_color
  }
  
  if (rule.text_color) {
    style.color = rule.text_color
  }
  
  return style
}
