// Client-side import will be done dynamically

/**
 * Convert CSV value to proper type for database
 */
function convertValue(value: any, type: 'text' | 'number' | 'boolean' | 'date'): any {
  if (value === null || value === undefined || value === '') {
    return null
  }

  switch (type) {
    case 'number':
      const num = Number(value)
      return isNaN(num) ? null : num
    case 'boolean':
      const str = String(value).toLowerCase().trim()
      return str === 'true' || str === '1' || str === 'yes'
    case 'date':
      const date = new Date(value)
      return isNaN(date.getTime()) ? null : date.toISOString()
    case 'text':
    default:
      return String(value)
  }
}

/**
 * Insert rows into Supabase table in batches
 * Note: This needs to be called from client-side, so we'll use the client
 */
export async function insertRows(
  tableName: string,
  rows: Record<string, any>[],
  columnTypes: Record<string, 'text' | 'number' | 'boolean' | 'date'>,
  columnNameMap?: Record<string, string>
): Promise<{ success: boolean; inserted: number; error?: string }> {
  const BATCH_SIZE = 500
  let inserted = 0

  try {
    // Import client dynamically since this runs client-side
    const { supabase } = await import('@/lib/supabase/client')
    
    // Process in batches
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      
      // Convert values to proper types and map to sanitized column names
      const convertedBatch = batch.map(row => {
        const converted: Record<string, any> = {}
        Object.keys(row).forEach(key => {
          // Use column name map if provided, otherwise sanitize
          const sanitizedName = columnNameMap?.[key] || 
            key.toLowerCase().trim().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_')
          
          const type = columnTypes[sanitizedName] || 'text'
          converted[sanitizedName] = convertValue(row[key], type)
        })
        return converted
      })

      const { error } = await supabase
        .from(tableName)
        .insert(convertedBatch)

      if (error) {
        console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, error)
        return {
          success: false,
          inserted,
          error: `Failed to insert rows: ${error.message}`
        }
      }

      inserted += batch.length
    }

    return { success: true, inserted }
  } catch (error: any) {
    console.error('Error inserting rows:', error)
    return {
      success: false,
      inserted,
      error: error.message || 'Failed to insert rows'
    }
  }
}
