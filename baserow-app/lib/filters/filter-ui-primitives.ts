/**
 * Shared filter UI primitives — single source for operators and group operators.
 * Filter UIs (view filters, block filters, automation conditions) should import from here
 * so operators and AND/OR behaviour stay aligned. Evaluation logic is unchanged.
 */

import type { GroupOperator } from './canonical-model'
import {
  getOperatorsForFieldType,
  getDefaultOperatorForFieldType,
  isOperatorValidForField,
} from './field-operators'

export type { FilterOperator } from './canonical-model'
export type { OperatorOption } from './field-operators'
export { getOperatorsForFieldType, getDefaultOperatorForFieldType, isOperatorValidForField }

/** Group operators for filter UIs (AND/OR). Use for group-level selector. */
export const GROUP_OPERATORS: { value: GroupOperator; label: string }[] = [
  { value: 'AND', label: 'And' },
  { value: 'OR', label: 'Or' },
]

export type { GroupOperator }
