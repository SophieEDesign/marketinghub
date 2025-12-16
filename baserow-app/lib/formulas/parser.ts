import type { Token, ASTNode } from './types'

const OPERATOR_PRECEDENCE: Record<string, number> = {
  'OR': 1,
  'AND': 2,
  '=': 3, '==': 3, '!=': 3,
  '<': 4, '>': 4, '<=': 4, '>=': 4,
  '+': 5, '-': 5,
  '*': 6, '/': 6,
}

const OPERATOR_ASSOCIATIVITY: Record<string, 'left' | 'right'> = {
  'OR': 'left',
  'AND': 'left',
  '=': 'left', '==': 'left', '!=': 'left',
  '<': 'left', '>': 'left', '<=': 'left', '>=': 'left',
  '+': 'left', '-': 'left',
  '*': 'left', '/': 'left',
}

export class Parser {
  private tokens: Token[]
  private position: number

  constructor(tokens: Token[]) {
    this.tokens = tokens.filter(t => t.type !== 'WHITESPACE')
    this.position = 0
  }

  private currentToken(): Token {
    return this.tokens[this.position] || { type: 'EOF', value: '', position: 0 }
  }

  private advance() {
    if (this.position < this.tokens.length) {
      this.position++
    }
  }

  private expect(type: string, value?: string) {
    const token = this.currentToken()
    if (token.type !== type || (value && token.value !== value)) {
      throw new Error(`Expected ${type}${value ? ` with value ${value}` : ''}, got ${token.type} at position ${token.position}`)
    }
    this.advance()
    return token
  }

  private parsePrimary(): ASTNode {
    const token = this.currentToken()

    switch (token.type) {
      case 'NUMBER':
        this.advance()
        return { type: 'NUMBER', value: parseFloat(token.value) }

      case 'STRING':
        this.advance()
        return { type: 'STRING', value: token.value }

      case 'FIELD_REF':
        this.advance()
        return { type: 'FIELD_REF', value: token.value }

      case 'FUNCTION':
        return this.parseFunctionCall()

      case 'LPAREN':
        this.advance()
        const expr = this.parseExpression()
        this.expect('RPAREN')
        return expr

      case 'OPERATOR':
        if (token.value === '-') {
          this.advance()
          return {
            type: 'UNARY_OP',
            operator: '-',
            operand: this.parsePrimary()
          }
        }
        throw new Error(`Unexpected operator ${token.value} at position ${token.position}`)

      default:
        throw new Error(`Unexpected token ${token.type} at position ${token.position}`)
    }
  }

  private parseFunctionCall(): ASTNode {
    const funcToken = this.expect('FUNCTION')
    const functionName = funcToken.value

    this.expect('LPAREN')

    const args: ASTNode[] = []

    if (this.currentToken().type !== 'RPAREN') {
      args.push(this.parseExpression())

      while (this.currentToken().type === 'COMMA') {
        this.advance()
        args.push(this.parseExpression())
      }
    }

    this.expect('RPAREN')

    return {
      type: 'FUNCTION_CALL',
      functionName,
      arguments: args
    }
  }

  private parseExpression(minPrecedence: number = 0): ASTNode {
    let left = this.parsePrimary()

    while (true) {
      const token = this.currentToken()
      
      // Check for logical operators
      if (token.type === 'LOGICAL') {
        const op = token.value
        const precedence = OPERATOR_PRECEDENCE[op] || 0

        if (precedence < minPrecedence) break

        this.advance()
        const right = this.parseExpression(precedence + (OPERATOR_ASSOCIATIVITY[op] === 'right' ? 0 : 1))

        left = {
          type: 'LOGICAL_OP',
          operator: op,
          left,
          right
        }
        continue
      }

      // Check for comparison/arithmetic operators
      if (token.type === 'OPERATOR') {
        const op = token.value
        const precedence = OPERATOR_PRECEDENCE[op] || 0

        if (precedence < minPrecedence) break

        this.advance()
        const right = this.parseExpression(precedence + (OPERATOR_ASSOCIATIVITY[op] === 'right' ? 0 : 1))

        left = {
          type: 'BINARY_OP',
          operator: op,
          left,
          right
        }
        continue
      }

      break
    }

    return left
  }

  parse(): ASTNode {
    if (this.tokens.length === 0 || (this.tokens.length === 1 && this.tokens[0].type === 'EOF')) {
      throw new Error('Empty formula')
    }

    const ast = this.parseExpression()

    if (this.currentToken().type !== 'EOF') {
      throw new Error(`Unexpected token after expression: ${this.currentToken().type} at position ${this.currentToken().position}`)
    }

    return ast
  }
}
