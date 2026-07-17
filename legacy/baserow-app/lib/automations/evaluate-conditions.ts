/**
 * Evaluate automation conditions from filter tree
 */

import type { FilterTree, FilterGroup, FilterCondition } from '@/lib/filters/canonical-model'
import type { TableField } from '@/types/fields'
import { normalizeFilterTree } from '@/lib/filters/canonical-model'
import { Tokenizer } from '@/lib/formulas/tokenizer'
import { Parser } from '@/lib/formulas/parser'
import { Evaluator } from '@/lib/formulas/evaluator'
import { filterTreeToFormula } from './condition-formula'

/**
 * Evaluate conditions against a record
 * Returns true if conditions are met, false otherwise
 */
export async function evaluateConditions(
  filterTree: FilterTree,
  record: Record<string, any>,
  tableFields: TableField[]
): Promise<boolean> {
  if (!filterTree) {
    // No conditions = always run
    return true
  }

  // Convert filter tree to formula and evaluate
  const formula = filterTreeToFormula(filterTree, tableFields)
  
  if (!formula || !formula.trim()) {
    // Empty formula = always run
    return true
  }

  try {
    // Tokenize and parse
    const tokenizer = new Tokenizer(formula)
    const tokens = tokenizer.tokenize()
    const parser = new Parser(tokens)
    const ast = parser.parse()

    // Evaluate
    const evaluator = new Evaluator({
      row: record,
      fields: tableFields.map(f => ({ name: f.name, type: f.type }))
    })

    const result = evaluator.evaluate(ast)
    
    // Convert result to boolean
    // Truthy values (except error strings) = true
    if (typeof result === 'string' && result.startsWith('#')) {
      // Error = false
      return false
    }
    
    return Boolean(result) && result !== false && result !== 0 && result !== ''
  } catch (error) {
    console.error('Error evaluating conditions:', error)
    // On error, don't run automation (fail safe)
    return false
  }
}
