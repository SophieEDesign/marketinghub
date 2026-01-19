import type { FieldType, FieldOptions } from '@/types/fields'

function quoteIdent(ident: string): string {
  // Double-quote an identifier and escape embedded quotes.
  return `"${String(ident ?? '').replace(/"/g, '""')}"`
}

function quoteMaybeQualifiedName(name: string): string {
  // Support schema-qualified names like `public.table_x`.
  // If more than one dot exists, treat the whole string as a single identifier.
  const raw = String(name ?? '')
  const parts = raw.split('.')
  if (parts.length === 2 && parts[0] && parts[1]) {
    return `${quoteIdent(parts[0])}.${quoteIdent(parts[1])}`
  }
  return quoteIdent(raw)
}

/**
 * Map Airtable field type to PostgreSQL type
 */
export function mapFieldTypeToPostgres(fieldType: FieldType, options?: FieldOptions): string {
  switch (fieldType) {
    case 'text':
    case 'long_text':
    case 'url':
    case 'email':
      return 'text'
    case 'number':
    case 'percent':
    case 'currency':
      return 'numeric'
    case 'date':
      return 'timestamptz'
    case 'single_select':
      return 'text'
    case 'multi_select':
      return 'text[]'
    case 'checkbox':
      return 'boolean'
    case 'attachment':
    case 'json':
      return 'jsonb'
    case 'link_to_table':
      // Linked fields can be single (uuid) or multi (uuid[]).
      // Multi is controlled by relationship_type / max_selections in field options.
      // Defaulting multi here matches the UI defaults (one-to-many) and prevents 22P02 errors
      // when the picker returns an array of UUIDs.
      {
        const relationshipType = options?.relationship_type
        const maxSelections = options?.max_selections
        const isMulti =
          relationshipType === 'one-to-many' ||
          relationshipType === 'many-to-many' ||
          (typeof maxSelections === 'number' && maxSelections > 1)
        return isMulti ? 'uuid[]' : 'uuid'
      }
    case 'formula':
    case 'lookup':
      // Virtual fields don't have SQL columns
      throw new Error(`Field type ${fieldType} is virtual and does not have a SQL column`)
    default:
      return 'text'
  }
}

/**
 * Generate SQL to add a column
 */
export function generateAddColumnSQL(
  tableName: string,
  columnName: string,
  fieldType: FieldType,
  options?: FieldOptions
): string {
  if (fieldType === 'formula' || fieldType === 'lookup') {
    throw new Error('Cannot add SQL column for virtual field type')
  }

  const pgType = mapFieldTypeToPostgres(fieldType, options)
  return `ALTER TABLE ${quoteMaybeQualifiedName(tableName)} ADD COLUMN ${quoteIdent(columnName)} ${pgType};`
}

/**
 * Generate SQL to rename a column
 */
export function generateRenameColumnSQL(
  tableName: string,
  oldColumnName: string,
  newColumnName: string
): string {
  return `ALTER TABLE ${quoteMaybeQualifiedName(tableName)} RENAME COLUMN ${quoteIdent(oldColumnName)} TO ${quoteIdent(newColumnName)};`
}

/**
 * Generate SQL to change column type
 */
export function generateChangeColumnTypeSQL(
  tableName: string,
  columnName: string,
  oldType: FieldType,
  newType: FieldType,
  options?: FieldOptions
): string {
  if (newType === 'formula' || newType === 'lookup') {
    throw new Error('Cannot change to virtual field type')
  }

  const sanitizedColumnName = String(columnName ?? '').replace(/"/g, '""')
  const newPgType = mapFieldTypeToPostgres(newType, options)

  // Use USING clause for safe type conversion
  let usingClause = ''
  
  if (oldType === 'text' && newType === 'number') {
    usingClause = ' USING CASE WHEN trim("' + sanitizedColumnName + '") = \'\' THEN NULL ELSE CAST(trim("' + sanitizedColumnName + '") AS numeric) END'
  } else if (oldType === 'number' && newType === 'text') {
    usingClause = ' USING CAST("' + sanitizedColumnName + '" AS text)'
  } else if (oldType === 'text' && newType === 'checkbox') {
    usingClause = ' USING CASE WHEN LOWER(trim("' + sanitizedColumnName + '")) IN (\'true\', \'1\', \'yes\', \'t\') THEN true WHEN LOWER(trim("' + sanitizedColumnName + '")) IN (\'false\', \'0\', \'no\', \'f\', \'\') THEN false ELSE NULL END'
  } else if (oldType === 'checkbox' && newType === 'text') {
    usingClause = ' USING CASE WHEN "' + sanitizedColumnName + '" = true THEN \'true\' WHEN "' + sanitizedColumnName + '" = false THEN \'false\' ELSE NULL END'
  } else if (oldType === 'text' && newType === 'date') {
    usingClause = ' USING CASE WHEN trim("' + sanitizedColumnName + '") = \'\' THEN NULL ELSE CAST(trim("' + sanitizedColumnName + '") AS timestamptz) END'
  } else if (oldType === 'date' && newType === 'text') {
    usingClause = ' USING CAST("' + sanitizedColumnName + '" AS text)'
  }

  return `ALTER TABLE ${quoteMaybeQualifiedName(tableName)} ALTER COLUMN ${quoteIdent(columnName)} TYPE ${newPgType}${usingClause};`
}

/**
 * Generate SQL to drop a column
 */
export function generateDropColumnSQL(
  tableName: string,
  columnName: string
): string {
  return `ALTER TABLE ${quoteMaybeQualifiedName(tableName)} DROP COLUMN IF EXISTS ${quoteIdent(columnName)};`
}

/**
 * Check if type change is destructive (may lose data)
 */
export function isDestructiveTypeChange(
  oldType: FieldType,
  newType: FieldType
): boolean {
  // Changes that might lose data
  const destructiveChanges = [
    ['number', 'text'], // Precision loss
    ['date', 'text'], // Format loss
    ['text[]', 'text'], // Array to single value
    ['text', 'text[]'], // Single to array (might fail)
  ]

  return destructiveChanges.some(
    ([old, newT]) => oldType === old && newType === newT
  ) || (
    oldType !== 'text' && newType === 'text' && oldType !== 'long_text'
  )
}
