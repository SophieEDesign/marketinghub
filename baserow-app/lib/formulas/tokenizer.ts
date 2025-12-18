import type { Token, TokenType } from './types'

const OPERATORS = ['+', '-', '*', '/', '>', '<', '>=', '<=', '=', '!=', '==']
const LOGICAL_OPS = ['AND', 'OR', 'NOT']
const FUNCTIONS = [
  'CONCAT', 'UPPER', 'LOWER', 'LEFT', 'RIGHT', 'LEN',
  'FIND', 'SUBSTITUTE', 'ROUND', 'FLOOR', 'CEILING',
  'IF', 'SWITCH', 'DATEADD', 'DATETIME_FORMAT',
  'NOW', 'TODAY'
]

export class Tokenizer {
  private input: string
  private position: number
  private currentChar: string | null

  constructor(input: string) {
    this.input = input.trim()
    this.position = 0
    this.currentChar = this.input[0] || null
  }

  private advance() {
    this.position++
    this.currentChar = this.position < this.input.length ? this.input[this.position] : null
  }

  private skipWhitespace() {
    while (this.currentChar && /\s/.test(this.currentChar)) {
      this.advance()
    }
  }

  private readNumber(): string {
    let num = ''
    let hasDecimal = false

    while (this.currentChar && (/[0-9.]/.test(this.currentChar))) {
      if (this.currentChar === '.') {
        if (hasDecimal) break
        hasDecimal = true
      }
      num += this.currentChar
      this.advance()
    }

    return num
  }

  private readString(): string {
    let str = ''
    const quote = this.currentChar
    this.advance() // Skip opening quote

    while (this.currentChar && this.currentChar !== quote) {
      if (this.currentChar === '\\') {
        this.advance()
        const escapedChar = this.currentChar
        if (escapedChar === 'n') {
          str += '\n'
        } else if (escapedChar === 't') {
          str += '\t'
        } else if (escapedChar) {
          str += escapedChar
        }
      } else {
        str += this.currentChar
      }
      this.advance()
    }

    if (this.currentChar === quote) {
      this.advance() // Skip closing quote
    }

    return str
  }

  private readFieldReference(): string {
    let fieldName = ''
    this.advance() // Skip opening {

    while (this.currentChar && this.currentChar !== '}') {
      fieldName += this.currentChar
      this.advance()
    }

    if (this.currentChar === '}') {
      this.advance() // Skip closing }
    }

    return fieldName.trim()
  }

  private readIdentifier(): string {
    let ident = ''
    while (this.currentChar && /[a-zA-Z0-9_]/.test(this.currentChar)) {
      ident += this.currentChar
      this.advance()
    }
    return ident
  }

  private readOperator(): string {
    // Check for multi-character operators first
    if (this.position + 1 < this.input.length) {
      const twoChar = this.input.substring(this.position, this.position + 2)
      if (twoChar === '>=' || twoChar === '<=' || twoChar === '!=' || twoChar === '==') {
        this.advance()
        this.advance()
        return twoChar
      }
    }

    const op = this.currentChar
    this.advance()
    return op || ''
  }

  tokenize(): Token[] {
    const tokens: Token[] = []

    while (this.currentChar !== null) {
      this.skipWhitespace()

      if (!this.currentChar) break

      const startPos = this.position

      // Number
      if (/[0-9]/.test(this.currentChar)) {
        const num = this.readNumber()
        tokens.push({ type: 'NUMBER', value: num, position: startPos })
        continue
      }

      // String (single or double quotes)
      if (this.currentChar === '"' || this.currentChar === "'") {
        const str = this.readString()
        tokens.push({ type: 'STRING', value: str, position: startPos })
        continue
      }

      // Field reference {Field Name}
      if (this.currentChar === '{') {
        const fieldName = this.readFieldReference()
        tokens.push({ type: 'FIELD_REF', value: fieldName, position: startPos })
        continue
      }

      // Operators
      if (OPERATORS.some(op => op.startsWith(this.currentChar || ''))) {
        const op = this.readOperator()
        tokens.push({ type: 'OPERATOR', value: op, position: startPos })
        continue
      }

      // Parentheses
      if (this.currentChar === '(') {
        tokens.push({ type: 'LPAREN', value: '(', position: startPos })
        this.advance()
        continue
      }

      if (this.currentChar === ')') {
        tokens.push({ type: 'RPAREN', value: ')', position: startPos })
        this.advance()
        continue
      }

      // Comma
      if (this.currentChar === ',') {
        tokens.push({ type: 'COMMA', value: ',', position: startPos })
        this.advance()
        continue
      }

      // Identifier (function or logical operator)
      if (/[a-zA-Z_]/.test(this.currentChar)) {
        const ident = this.readIdentifier().toUpperCase()
        
        if (LOGICAL_OPS.includes(ident)) {
          tokens.push({ type: 'LOGICAL', value: ident, position: startPos })
        } else if (FUNCTIONS.includes(ident)) {
          tokens.push({ type: 'FUNCTION', value: ident, position: startPos })
        } else {
          // Unknown identifier - treat as error or field reference
          tokens.push({ type: 'FIELD_REF', value: ident, position: startPos })
        }
        continue
      }

      // Unknown character
      throw new Error(`Unexpected character: ${this.currentChar} at position ${this.position}`)
    }

    tokens.push({ type: 'EOF', value: '', position: this.position })
    return tokens
  }
}
