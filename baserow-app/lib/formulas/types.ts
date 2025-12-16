export type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'FIELD_REF'
  | 'OPERATOR'
  | 'LOGICAL'
  | 'FUNCTION'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'WHITESPACE'
  | 'EOF'

export interface Token {
  type: TokenType
  value: string
  position: number
}

export type ASTNodeType =
  | 'NUMBER'
  | 'STRING'
  | 'FIELD_REF'
  | 'BINARY_OP'
  | 'UNARY_OP'
  | 'FUNCTION_CALL'
  | 'LOGICAL_OP'

export interface ASTNode {
  type: ASTNodeType
  value?: any
  operator?: string
  left?: ASTNode
  right?: ASTNode
  operand?: ASTNode
  functionName?: string
  arguments?: ASTNode[]
}

export type FormulaValue = string | number | boolean | Date | null
export type FormulaError = '#FIELD!' | '#ERROR!' | '#DIV/0!' | '#VALUE!'

export interface FormulaContext {
  row: Record<string, any>
  fields: Array<{ name: string; type: string }>
}
