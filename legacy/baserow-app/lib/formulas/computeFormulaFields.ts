import { Tokenizer } from './tokenizer'
import { Parser } from './parser'
import { Evaluator } from './evaluator'
import type { TableField } from '@/types/fields'
import type { FormulaValue, FormulaError } from './types'

export interface ComputedRow extends Record<string, any> {
  [key: string]: any
}

/**
 * Compute formula field values for a row
 */
export function computeFormulaFields(
  row: Record<string, any>,
  formulaFields: TableField[],
  allFields: TableField[]
): ComputedRow {
  const computed: ComputedRow = { ...row }

  for (const formulaField of formulaFields) {
    const formula = formulaField.options?.formula as string | undefined

    if (!formula || !formula.trim()) {
      computed[formulaField.name] = null
      continue
    }

    try {
      // Tokenize and parse
      const tokenizer = new Tokenizer(formula)
      const tokens = tokenizer.tokenize()
      const parser = new Parser(tokens)
      const ast = parser.parse()

      // Evaluate
      const evaluator = new Evaluator({
        row: computed, // Use computed so formulas can reference other formulas
        fields: allFields.map(f => ({ name: f.name, type: f.type }))
      })

      const result = evaluator.evaluate(ast)
      computed[formulaField.name] = result
    } catch (error) {
      // Parse or evaluation error
      computed[formulaField.name] = '#ERROR!'
    }
  }

  return computed
}

/**
 * Validate formula syntax without evaluating
 */
export function validateFormula(formula: string): { valid: boolean; error?: string } {
  if (!formula || !formula.trim()) {
    return { valid: false, error: 'Formula cannot be empty' }
  }

  try {
    const tokenizer = new Tokenizer(formula)
    const tokens = tokenizer.tokenize()
    const parser = new Parser(tokens)
    parser.parse()
    return { valid: true }
  } catch (error: any) {
    return { valid: false, error: error.message || 'Invalid formula syntax' }
  }
}
