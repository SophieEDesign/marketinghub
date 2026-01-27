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

/**
 * Predefined colour palettes for select/multi-select "pill" rendering.
 * - `vibrant`: current default behaviour (semantic for single-select, muted for multi-select)
 * - Other themes are fixed palettes (useful for brand-aligned or calmer visuals)
 */
export type ChoiceColorTheme = 'vibrant' | 'pastel' | 'blues' | 'heatmap' | 'cool' | 'earth' | 'sunset' | 'ocean' | 'forest' | 'grayscale' | 'rainbow'

export interface SelectOption {
  id: string
  label: string
  color?: string
  /** Authoritative manual order. UI order = sort_index ASC */
  sort_index: number
  created_at?: string
}

export interface TableField {
  id: string
  table_id: string
  name: string
  /**
   * Human-friendly field title as entered by the user (spaces/casing preserved).
   * If missing (older data), UI should fall back to formatting `name`.
   */
  label?: string | null
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
  choiceColors?: Record<string, string> // Map of choice value to hex color (option-level override)
  choiceColorTheme?: ChoiceColorTheme // Palette used when no option-level override exists
  /**
   * Canonical option model for single/multi select.
   * This is the single source of truth for ordering via `sort_index`.
   *
   * NOTE: record values are still stored as labels (strings) for backwards compatibility.
   */
  selectOptions?: SelectOption[]
  
  // Field-level color override (applies to entire field when no option-level override exists)
  fieldColor?: string // Hex color for the field (applies to linked records, lookups, or as fallback for selects)
  
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
  
  // For attachment fields
  attachment_display_style?: 'thumbnails' | 'list' | 'hero' | 'cover' | 'gallery' // Display style for attachments
  attachment_preview_size?: 'small' | 'medium' | 'large' // Preview size for attachments
  attachment_max_visible?: number // Max number of previews to show (default: 3 for grid, 10 for record view)
  
  // For read-only (stored in options since not in schema)
  read_only?: boolean

  // Some metadata fields are flagged as "system" (not user-editable / hidden from certain UIs).
  // This is stored in options for backward compatibility with older schemas.
  system?: boolean
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

/**
 * Linked Field Type
 * 
 * A linked field creates a relationship between records in two tables.
 * - Stores record IDs only (single: string, or multiple: string[])
 * - Editable and participates in batch updates and undo
 * - Display values are resolved separately from stored IDs
 * - Can be copied (uses display labels) and pasted (resolves labels to IDs)
 * 
 * Value format:
 * - Single link: string (UUID)
 * - Multi-link: string[] (array of UUIDs)
 */
export interface LinkedField extends TableField {
  type: 'link_to_table'
  options: FieldOptions & {
    linked_table_id: string // Required: target table ID
    linked_field_id?: string // Optional: field in target table for relationship
  }
}

/**
 * Lookup Field Type
 * 
 * A lookup field displays data from a linked field's target records.
 * - Stores no values (computed at runtime)
 * - Always read-only
 * - Cannot be pasted into or directly edited
 * - Depends on exactly one linked field (link_to_table) in the current table (via lookup_field_id)
 * - The linked field must connect to the lookup_table_id
 * - Recomputes automatically when linked data changes
 * 
 * Value format:
 * - Computed at runtime, never stored
 * - Type depends on lookup_result_field_id in target table
 */
export interface LookupField extends TableField {
  type: 'lookup'
  options: FieldOptions & {
    lookup_table_id: string // Required: table to lookup from
    lookup_field_id: string // Required: linked field ID (link_to_table) in the current table that links to lookup_table_id
    lookup_result_field_id: string // Required: field in lookup table to display
  }
}

/**
 * Type guard: Check if a field is a linked field
 */
export function isLinkedField(field: TableField): field is LinkedField {
  return field.type === 'link_to_table' && !!field.options?.linked_table_id
}

/**
 * Type guard: Check if a field is a lookup field
 */
export function isLookupField(field: TableField): field is LookupField {
  return field.type === 'lookup' && 
    !!field.options?.lookup_table_id && 
    !!field.options?.lookup_field_id &&
    !!field.options?.lookup_result_field_id
}
