export type FieldType =
  | 'text'
  | 'long_text'
  | 'number'
  | 'percent'
  | 'currency'
  | 'date'
  | 'single_select'
  | 'multi_select'
  | 'checkbox'
  | 'attachment'
  | 'link_to_table'
  | 'formula'
  | 'lookup'

export interface TableField {
  id: string
  table_id: string
  name: string
  type: FieldType
  position: number
  required?: boolean
  default_value?: any
  options?: FieldOptions
  created_at: string
  updated_at?: string
}

export interface FieldOptions {
  // For select fields
  choices?: string[]
  
  // For number/currency/percent
  precision?: number
  
  // For currency
  currency_symbol?: string
  
  // For link_to_table
  linked_table_id?: string
  linked_field_id?: string
  
  // For formula
  formula?: string
  
  // For lookup
  lookup_table_id?: string
  lookup_field_id?: string
  lookup_result_field_id?: string
}

export interface FieldTypeInfo {
  type: FieldType
  label: string
  isVirtual: boolean
  postgresType?: string
  requiresOptions?: boolean
}

export const FIELD_TYPES: FieldTypeInfo[] = [
  { type: 'text', label: 'Single line text', isVirtual: false, postgresType: 'text' },
  { type: 'long_text', label: 'Long text', isVirtual: false, postgresType: 'text' },
  { type: 'number', label: 'Number', isVirtual: false, postgresType: 'numeric' },
  { type: 'percent', label: 'Percent', isVirtual: false, postgresType: 'numeric' },
  { type: 'currency', label: 'Currency', isVirtual: false, postgresType: 'numeric' },
  { type: 'date', label: 'Date', isVirtual: false, postgresType: 'timestamptz' },
  { type: 'single_select', label: 'Single select', isVirtual: false, postgresType: 'text', requiresOptions: true },
  { type: 'multi_select', label: 'Multiple select', isVirtual: false, postgresType: 'text[]', requiresOptions: true },
  { type: 'checkbox', label: 'Checkbox', isVirtual: false, postgresType: 'boolean' },
  { type: 'attachment', label: 'Attachment', isVirtual: false, postgresType: 'jsonb' },
  { type: 'link_to_table', label: 'Link to table', isVirtual: false, postgresType: 'uuid', requiresOptions: true },
  { type: 'formula', label: 'Formula', isVirtual: true },
  { type: 'lookup', label: 'Lookup', isVirtual: true, requiresOptions: true },
]

export const RESERVED_WORDS = [
  'id', 'created_at', 'updated_at', 'created_by', 'updated_by',
  'select', 'insert', 'update', 'delete', 'from', 'where', 'order', 'group', 'by',
  'table', 'view', 'field', 'column', 'row', 'data'
]
