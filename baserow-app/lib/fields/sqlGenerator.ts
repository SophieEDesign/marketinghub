import type { FieldType, FieldOptions } from '@/types/fields'

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
      return 'uuid'
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
  const sanitizedTableName = tableName.replace(/"/g, '""')
  const sanitizedColumnName = columnName.replace(/"/g, '""')

  return `ALTER TABLE "${sanitizedTableName}" ADD COLUMN "${sanitizedColumnName}" ${pgType};`
}

/**
 * Generate SQL to rename a column
 */
export function generateRenameColumnSQL(
  tableName: string,
  oldColumnName: string,
  newColumnName: string
): string {
  const sanitizedTableName = tableName.replace(/"/g, '""')
  const sanitizedOldName = oldColumnName.replace(/"/g, '""')
  const sanitizedNewName = newColumnName.replace(/"/g, '""')

  return `ALTER TABLE "${sanitizedTableName}" RENAME COLUMN "${sanitizedOldName}" TO "${sanitizedNewName}";`
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

  const sanitizedTableName = tableName.replace(/"/g, '""')
  const sanitizedColumnName = columnName.replace(/"/g, '""')
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

  return `ALTER TABLE "${sanitizedTableName}" ALTER COLUMN "${sanitizedColumnName}" TYPE ${newPgType}${usingClause};`
}

/**
 * Generate SQL to drop a column
 */
export function generateDropColumnSQL(
  tableName: string,
  columnName: string
): string {
  const sanitizedTableName = tableName.replace(/"/g, '""')
  const sanitizedColumnName = columnName.replace(/"/g, '""')

  return `ALTER TABLE "${sanitizedTableName}" DROP COLUMN IF EXISTS "${sanitizedColumnName}";`
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
