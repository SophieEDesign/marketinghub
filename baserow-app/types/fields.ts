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
  | 'url'
  | 'email'
  | 'json'
  | 'link_to_table'
  | 'formula'
  | 'lookup'

export interface TableField {
  id: string
  table_id: string
  name: string
  type: FieldType
  position: number
  order_index?: number
  group_name?: string | null
  required?: boolean
  default_value?: any
  options?: FieldOptions
  created_at: string
  updated_at?: string
}

export interface FieldOptions {
  // For select fields
  choices?: string[]
  choiceColors?: Record<string, string> // Map of choice value to hex color
  
  // For number/currency/percent
  precision?: number
  
  // For currency
  currency_symbol?: string
  
  // For date
  date_format?: string
  
  // For link_to_table
  linked_table_id?: string
  linked_field_id?: string
  
  // For formula
  formula?: string
  
  // For lookup
  lookup_table_id?: string
  lookup_field_id?: string
  lookup_result_field_id?: string
  
  // Lookup field display configuration
  primary_label_field?: string // Required field name for primary label
  secondary_label_fields?: string[] // Optional, max 2 field names for secondary context
  relationship_type?: 'one-to-one' | 'one-to-many' | 'many-to-many'
  max_selections?: number // For multi-select lookups
  allow_create?: boolean // Allow creating new related records
  
  // Lookup field filters (array of filters with AND logic)
  lookup_filters?: LookupFieldFilter[]
  
  // For read-only (stored in options since not in schema)
  read_only?: boolean
}

export interface LookupFieldFilter {
  // Field in the lookup table to filter on
  field: string
  
  // Filter operator
  operator: 'equal' | 'not_equal' | 'contains' | 'not_contains' | 
            'greater_than' | 'less_than' | 'greater_than_or_equal' | 
            'less_than_or_equal' | 'is_empty' | 'is_not_empty' | 
            'date_range'
  
  // Value source type
  valueSource: 'static' | 'current_record' | 'context'
  
  // Static value (when valueSource === 'static')
  value?: any
  
  // Reference to current record field (when valueSource === 'current_record')
  // Format: field_name
  currentRecordField?: string
  
  // Context value type (when valueSource === 'context')
  contextType?: 'current_user_id' | 'current_user_email' | 'current_date' | 'current_datetime'
  
  // Optional: Apply filter only when referenced field has a value
  // When true, skip this filter if the referenced field (currentRecordField) is null/empty
  applyOnlyWhenFieldHasValue?: boolean
  
  // For date_range operator
  value2?: any
  currentRecordField2?: string
  contextType2?: string
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
  { type: 'url', label: 'URL', isVirtual: false, postgresType: 'text' },
  { type: 'email', label: 'Email', isVirtual: false, postgresType: 'text' },
  { type: 'json', label: 'JSON', isVirtual: false, postgresType: 'jsonb' },
  { type: 'link_to_table', label: 'Link to table', isVirtual: false, postgresType: 'uuid', requiresOptions: true },
  { type: 'formula', label: 'Formula', isVirtual: true },
  { type: 'lookup', label: 'Lookup', isVirtual: true, requiresOptions: true },
]

export const RESERVED_WORDS = [
  'id', 'created_at', 'updated_at', 'created_by', 'updated_by',
  'select', 'insert', 'update', 'delete', 'from', 'where', 'order', 'group', 'by',
  'table', 'view', 'field', 'column', 'row', 'data'
]
