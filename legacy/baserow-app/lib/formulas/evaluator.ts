import type { ASTNode, FormulaValue, FormulaError, FormulaContext } from './types'
import { FORMULA_FUNCTIONS } from './functions'

export class Evaluator {
  private context: FormulaContext

  constructor(context: FormulaContext) {
    this.context = context
  }

  private isValidDate(d: Date): boolean {
    return d instanceof Date && !isNaN(d.getTime())
  }

  private toDate(value: FormulaValue): Date | null {
    if (value === null || value === undefined) return null
    if (value instanceof Date) return this.isValidDate(value) ? value : null
    const d = new Date(String(value))
    return this.isValidDate(d) ? d : null
  }

  private getFieldValue(fieldName: string): FormulaValue | FormulaError {
    // Find field by name (case-insensitive)
    const field = this.context.fields.find(
      f => f.name.toLowerCase() === fieldName.toLowerCase()
    )

    if (!field) {
      return '#FIELD!'
    }

    const value = this.context.row[field.name]
    
    // Convert to appropriate type based on field type
    if (value === null || value === undefined) {
      return null
    }

    // Type conversion based on field type
    switch (field.type) {
      case 'number':
      case 'percent':
      case 'currency':
        return typeof value === 'number' ? value : parseFloat(String(value)) || 0
      
      case 'checkbox':
        return Boolean(value)
      
      case 'date':
        return value instanceof Date ? value : new Date(String(value))
      
      default:
        return String(value)
    }
  }

  private compareValues(left: FormulaValue, operator: string, right: FormulaValue): boolean {
    // Handle null comparisons
    if (left === null || right === null) {
      if (operator === '=' || operator === '==') {
        return left === right
      }
      return false
    }

    // Date comparisons (supports Date objects and date-like strings)
    const leftDate = this.toDate(left)
    const rightDate = this.toDate(right)
    if (leftDate && rightDate) {
      const l = leftDate.getTime()
      const r = rightDate.getTime()
      switch (operator) {
        case '=':
        case '==':
          return l === r
        case '!=':
          return l !== r
        case '>':
          return l > r
        case '<':
          return l < r
        case '>=':
          return l >= r
        case '<=':
          return l <= r
        default:
          return false
      }
    }

    // Type coercion for comparisons
    if (typeof left === 'number' || typeof right === 'number') {
      const leftNum = typeof left === 'number' ? left : parseFloat(String(left))
      const rightNum = typeof right === 'number' ? right : parseFloat(String(right))
      
      if (!isNaN(leftNum) && !isNaN(rightNum)) {
        switch (operator) {
          case '=':
          case '==':
            return leftNum === rightNum
          case '!=':
            return leftNum !== rightNum
          case '>':
            return leftNum > rightNum
          case '<':
            return leftNum < rightNum
          case '>=':
            return leftNum >= rightNum
          case '<=':
            return leftNum <= rightNum
        }
      }
    }

    // String comparison
    const leftStr = String(left)
    const rightStr = String(right)

    switch (operator) {
      case '=':
      case '==':
        return leftStr === rightStr
      case '!=':
        return leftStr !== rightStr
      case '>':
        return leftStr > rightStr
      case '<':
        return leftStr < rightStr
      case '>=':
        return leftStr >= rightStr
      case '<=':
        return leftStr <= rightStr
      default:
        return false
    }
  }

  private evaluateBinaryOp(node: ASTNode): FormulaValue | FormulaError {
    const left = this.evaluate(node.left!)
    const right = this.evaluate(node.right!)

    if (typeof left === 'string' && left.startsWith('#')) return left as FormulaError
    if (typeof right === 'string' && right.startsWith('#')) return right as FormulaError

    const op = node.operator!

    // Comparison operators
    if (['=', '==', '!=', '<', '>', '<=', '>='].includes(op)) {
      return this.compareValues(left, op, right)
    }

    // Arithmetic operators
    const leftNum = typeof left === 'number' ? left : parseFloat(String(left))
    const rightNum = typeof right === 'number' ? right : parseFloat(String(right))

    if (isNaN(leftNum) || isNaN(rightNum)) {
      return '#VALUE!'
    }

    switch (op) {
      case '+':
        return leftNum + rightNum
      case '-':
        return leftNum - rightNum
      case '*':
        return leftNum * rightNum
      case '/':
        if (rightNum === 0) return '#DIV/0!'
        return leftNum / rightNum
      default:
        return '#ERROR!'
    }
  }

  private evaluateLogicalOp(node: ASTNode): FormulaValue | FormulaError {
    const left = this.evaluate(node.left!)
    const right = node.right ? this.evaluate(node.right) : null

    const op = node.operator!

    if (op === 'AND') {
      const leftBool = Boolean(left)
      if (!leftBool) return false
      return Boolean(right)
    }

    if (op === 'OR') {
      const leftBool = Boolean(left)
      if (leftBool) return true
      return Boolean(right)
    }

    return '#ERROR!'
  }

  private evaluateFunctionCall(node: ASTNode): FormulaValue | FormulaError {
    const funcName = node.functionName!
    const func = FORMULA_FUNCTIONS[funcName]

    if (!func) {
      return '#ERROR!'
    }

    const args = (node.arguments || []).map(arg => this.evaluate(arg))

    // Check for errors in arguments
    for (const arg of args) {
      if (typeof arg === 'string' && arg.startsWith('#')) {
        return arg as FormulaError
      }
    }

    try {
      return func(...args)
    } catch (error) {
      return '#ERROR!'
    }
  }

  evaluate(node: ASTNode | null): FormulaValue | FormulaError {
    if (!node) {
      return '#ERROR!'
    }

    try {
      switch (node.type) {
        case 'NUMBER':
          return node.value

        case 'STRING':
          return node.value

        case 'FIELD_REF':
          return this.getFieldValue(node.value)

        case 'BINARY_OP':
          return this.evaluateBinaryOp(node)

        case 'UNARY_OP':
          const operand = this.evaluate(node.operand!)
          if (typeof operand === 'string' && operand.startsWith('#')) {
            return operand as FormulaError
          }
          if (node.operator === '-') {
            const num = typeof operand === 'number' ? operand : parseFloat(String(operand))
            return isNaN(num) ? '#VALUE!' : -num
          }
          if (node.operator === 'NOT') {
            return !Boolean(operand)
          }
          return '#ERROR!'

        case 'LOGICAL_OP':
          return this.evaluateLogicalOp(node)

        case 'FUNCTION_CALL':
          return this.evaluateFunctionCall(node)

        default:
          return '#ERROR!'
      }
    } catch (error) {
      return '#ERROR!'
    }
  }
}
