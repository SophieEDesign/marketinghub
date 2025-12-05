import { supabase } from "@/lib/supabaseClient";
import { Field } from "@/lib/fields";
import { FieldMapping, transformRow } from "./transformRow";

export interface ImportOptions {
  tableId: string;
  mode: "insert" | "upsert";
  upsertKey?: string; // Field key to match on for upsert (default: "title")
}

export interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; error: string }>;
  warnings: Array<{ row: number; warning: string }>;
}

/**
 * Run the import process
 */
export async function runImport(
  csvRows: Record<string, string>[],
  mappings: FieldMapping[],
  fields: Field[],
  options: ImportOptions
): Promise<ImportResult> {
  const result: ImportResult = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    warnings: [],
  };

  const upsertKey = options.upsertKey || "title";
  const transformedRows: any[] = [];

  // Step 1: Transform all rows
  for (let i = 0; i < csvRows.length; i++) {
    const csvRow = csvRows[i];
    const transformResult = transformRow(csvRow, mappings, fields);

    // Collect warnings
    for (const warning of transformResult.warnings) {
      result.warnings.push({ row: i + 1, warning });
    }

    // Collect errors
    for (const error of transformResult.errors) {
      result.errors.push({ row: i + 1, error });
    }

    // Skip rows with errors
    if (transformResult.errors.length > 0) {
      result.skipped++;
      continue;
    }

    transformedRows.push(transformResult.row);
  }

  // Step 2: Handle unknown select options
  await addUnknownSelectOptions(transformedRows, mappings, fields);

  // Get all valid field keys for validation
  const validFieldKeys = new Set(fields.map(f => f.field_key));
  const invalidColumns: Set<string> = new Set();
  
  // Pre-validate all rows and collect invalid columns
  for (const row of transformedRows) {
    for (const key of Object.keys(row)) {
      if (!validFieldKeys.has(key) && 
          key !== 'id' && 
          key !== 'created_at' && 
          key !== 'updated_at' && 
          key !== upsertKey) {
        invalidColumns.add(key);
      }
    }
  }
  
  if (invalidColumns.size > 0) {
    console.warn(`[runImport] Found ${invalidColumns.size} columns that don't exist in table:`, Array.from(invalidColumns));
    // Add warnings for invalid columns
    for (const col of invalidColumns) {
      result.warnings.push({ row: 0, warning: `Column '${col}' does not exist in table and will be skipped` });
    }
  }
  
  console.log("[runImport] Starting import:", { 
    tableId: options.tableId, 
    mode: options.mode, 
    upsertKey, 
    rowCount: transformedRows.length,
    validColumns: validFieldKeys.size,
    invalidColumns: invalidColumns.size
  });

  // Step 3: Import rows
  if (options.mode === "upsert") {
    // Upsert mode: update existing or insert new
    for (let i = 0; i < transformedRows.length; i++) {
      const row = transformedRows[i];
      
      if (!row[upsertKey]) {
        result.errors.push({ row: i + 1, error: `Missing ${upsertKey} field for upsert` });
        result.skipped++;
        continue;
      }

      try {
        // Check if record exists
        const { data: existing, error: checkError } = await supabase
          .from(options.tableId)
          .select("id")
          .eq(upsertKey, row[upsertKey])
          .limit(1)
          .maybeSingle();

        if (checkError && checkError.code !== "PGRST116") {
          // PGRST116 is "not found" which is fine, other errors are real
          console.error(`[runImport] Check error for row ${i + 1}:`, checkError);
          result.errors.push({ row: i + 1, error: `Check failed: ${checkError.message}` });
          result.skipped++;
          continue;
        }

        if (existing) {
          // Filter row to only include columns that exist in the table
          const safeRow = filterRowToExistingColumns(row, fields, upsertKey);
          // Remove id from update (it's in the WHERE clause)
          delete safeRow.id;
          
          const { error: updateError } = await supabase
            .from(options.tableId)
            .update(safeRow)
            .eq("id", existing.id);

          if (updateError) {
            // Check for PostgREST schema cache errors or missing column errors
            const isColumnError = 
              updateError.code === '42703' || 
              updateError.message?.includes('does not exist') ||
              updateError.message?.includes('Could not find') ||
              updateError.message?.includes('schema cache');
            
            if (isColumnError) {
              console.warn(`[runImport] Column doesn't exist, trying with minimal columns for row ${i + 1}`);
              // Extract column name from error if possible
              const columnMatch = updateError.message?.match(/['"]([^'"]+)['"]/);
              const badColumn = columnMatch ? columnMatch[1] : null;
              
              // Try with only basic columns that should exist
              const minimalRow: any = {};
              if (safeRow[upsertKey] !== undefined && safeRow[upsertKey] !== badColumn) {
                minimalRow[upsertKey] = safeRow[upsertKey];
              }
              if (safeRow.created_at !== undefined) minimalRow.created_at = safeRow.created_at;
              if (safeRow.updated_at !== undefined) minimalRow.updated_at = safeRow.updated_at;
              
              // Only include other columns that are in the fields list and exist in safeRow
              for (const field of fields) {
                if (safeRow[field.field_key] !== undefined && 
                    field.field_key !== badColumn &&
                    field.field_key !== upsertKey &&
                    field.field_key !== 'id' &&
                    field.field_key !== 'created_at' &&
                    field.field_key !== 'updated_at') {
                  minimalRow[field.field_key] = safeRow[field.field_key];
                }
              }
              
              // If minimal row is empty or only has timestamps, skip
              const hasData = Object.keys(minimalRow).some(key => 
                key !== 'created_at' && key !== 'updated_at'
              );
              if (!hasData) {
                result.errors.push({ row: i + 1, error: `No valid columns to update after filtering out non-existent columns` });
                result.skipped++;
                continue;
              }
              
              const { error: minimalError } = await supabase
                .from(options.tableId)
                .update(minimalRow)
                .eq("id", existing.id);
              
              if (minimalError) {
                console.error(`[runImport] Update error for row ${i + 1}:`, minimalError);
                result.errors.push({ row: i + 1, error: `Update failed: ${minimalError.message}` });
                result.skipped++;
                continue;
              } else {
                result.updated++;
                if (badColumn) {
                  result.warnings.push({ row: i + 1, warning: `Column '${badColumn}' does not exist in table and was skipped` });
                }
              }
            } else {
              console.error(`[runImport] Update error for row ${i + 1}:`, updateError);
              result.errors.push({ row: i + 1, error: `Update failed: ${updateError.message}` });
              result.skipped++;
              continue;
            }
          } else {
            result.updated++;
          }
        } else {
          // Insert new record
          // Filter row to only include columns that exist in the table
          const safeRow = filterRowToExistingColumns(row, fields, upsertKey);
          delete safeRow.id; // Don't insert id, let DB generate it
          
          // If no valid columns after filtering, skip this row
          if (Object.keys(safeRow).length === 0) {
            result.errors.push({ row: i + 1, error: `No valid columns to insert - all mapped columns do not exist in table` });
            result.skipped++;
            continue;
          }
          
          const { error: insertError } = await supabase
            .from(options.tableId)
            .insert([safeRow]);

          if (insertError) {
            // Check for PostgREST schema cache errors or missing column errors
            const isColumnError = 
              insertError.code === '42703' || 
              insertError.message?.includes('does not exist') ||
              insertError.message?.includes('Could not find') ||
              insertError.message?.includes('schema cache');
            
            if (isColumnError) {
              console.warn(`[runImport] Column doesn't exist, trying with minimal columns for row ${i + 1}`);
              // Extract column name from error if possible
              const columnMatch = insertError.message?.match(/['"]([^'"]+)['"]/);
              const badColumn = columnMatch ? columnMatch[1] : null;
              
              // Remove the problematic column and try again
              const minimalRow: any = {};
              if (safeRow[upsertKey] !== undefined && safeRow[upsertKey] !== badColumn) {
                minimalRow[upsertKey] = safeRow[upsertKey];
              }
              if (safeRow.created_at !== undefined) minimalRow.created_at = safeRow.created_at;
              if (safeRow.updated_at !== undefined) minimalRow.updated_at = safeRow.updated_at;
              
              // Only include other columns that are in the fields list and exist in safeRow
              for (const field of fields) {
                if (safeRow[field.field_key] !== undefined && 
                    field.field_key !== badColumn &&
                    field.field_key !== upsertKey &&
                    field.field_key !== 'id' &&
                    field.field_key !== 'created_at' &&
                    field.field_key !== 'updated_at') {
                  minimalRow[field.field_key] = safeRow[field.field_key];
                }
              }
              
              // If minimal row is empty or only has timestamps, skip
              const hasData = Object.keys(minimalRow).some(key => 
                key !== 'created_at' && key !== 'updated_at'
              );
              if (!hasData) {
                result.errors.push({ row: i + 1, error: `No valid columns to insert after filtering out non-existent columns` });
                result.skipped++;
                continue;
              }
              
              const { error: minimalError } = await supabase
                .from(options.tableId)
                .insert([minimalRow]);
              
              if (minimalError) {
                console.error(`[runImport] Insert error for row ${i + 1}:`, minimalError);
                result.errors.push({ row: i + 1, error: `Insert failed: ${minimalError.message}` });
                result.skipped++;
                continue;
              } else {
                result.inserted++;
                if (badColumn) {
                  result.warnings.push({ row: i + 1, warning: `Column '${badColumn}' does not exist in table and was skipped` });
                }
              }
            } else {
              console.error(`[runImport] Insert error for row ${i + 1}:`, insertError);
              result.errors.push({ row: i + 1, error: `Insert failed: ${insertError.message}` });
              result.skipped++;
              continue;
            }
          } else {
            result.inserted++;
          }
        }
      } catch (err: any) {
        console.error(`[runImport] Exception for row ${i + 1}:`, err);
        result.errors.push({ row: i + 1, error: err.message || "Unknown error" });
        result.skipped++;
      }
    }
  } else {
    // Insert mode: only insert new records
    // Batch insert for better performance
    const batchSize = 100;
    for (let i = 0; i < transformedRows.length; i += batchSize) {
      const batch = transformedRows.slice(i, i + batchSize);
      
      try {
        // Filter each row to only include columns that exist in the table
        const safeBatch = batch.map(row => {
          const filtered = filterRowToExistingColumns(row, fields, upsertKey);
          delete filtered.id; // Don't insert id, let DB generate it
          return filtered;
        }).filter(row => Object.keys(row).length > 0); // Remove empty rows
        
        const { error: insertError } = await supabase
          .from(options.tableId)
          .insert(safeBatch);

        if (insertError) {
          // If batch fails due to missing columns, try individual inserts with error handling
          if (insertError.code === '42703' || insertError.message?.includes('does not exist')) {
            console.warn(`[runImport] Some columns don't exist, trying individual inserts for batch starting at row ${i + 1}`);
            // Try individual inserts
            for (let j = 0; j < safeBatch.length; j++) {
              try {
                const { error: singleError } = await supabase
                  .from(options.tableId)
                  .insert([safeBatch[j]]);

                if (singleError) {
                  // If still fails, try with only the upsert key and timestamps
                  if (singleError.code === '42703' || singleError.message?.includes('does not exist')) {
                    const minimalRow: any = {};
                    if (safeBatch[j][upsertKey] !== undefined) minimalRow[upsertKey] = safeBatch[j][upsertKey];
                    if (safeBatch[j].created_at !== undefined) minimalRow.created_at = safeBatch[j].created_at;
                    if (safeBatch[j].updated_at !== undefined) minimalRow.updated_at = safeBatch[j].updated_at;
                    
                    const { error: minimalError } = await supabase
                      .from(options.tableId)
                      .insert([minimalRow]);
                    
                    if (minimalError) {
                      console.error(`[runImport] Minimal insert error for row ${i + j + 1}:`, minimalError);
                      result.errors.push({ row: i + j + 1, error: `Insert failed: ${minimalError.message}` });
                      result.skipped++;
                    } else {
                      result.inserted++;
                      result.warnings.push({ row: i + j + 1, warning: `Only basic fields inserted due to missing columns` });
                    }
                  } else {
                    console.error(`[runImport] Single insert error for row ${i + j + 1}:`, singleError);
                    result.errors.push({ row: i + j + 1, error: singleError.message });
                    result.skipped++;
                  }
                } else {
                  result.inserted++;
                }
              } catch (err: any) {
                console.error(`[runImport] Exception for row ${i + j + 1}:`, err);
                result.errors.push({ row: i + j + 1, error: err.message || "Unknown error" });
                result.skipped++;
              }
            }
          } else {
            console.error(`[runImport] Batch insert error for batch starting at row ${i + 1}:`, {
              error: insertError,
              message: insertError.message,
              details: insertError.details,
              hint: insertError.hint,
              code: insertError.code,
              tableId: options.tableId,
            });
            // If batch fails, try individual inserts
            for (let j = 0; j < safeBatch.length; j++) {
              try {
                const { error: singleError } = await supabase
                  .from(options.tableId)
                  .insert([safeBatch[j]]);

                if (singleError) {
                  console.error(`[runImport] Single insert error for row ${i + j + 1}:`, singleError);
                  result.errors.push({ row: i + j + 1, error: singleError.message });
                  result.skipped++;
                } else {
                  result.inserted++;
                }
              } catch (err: any) {
                console.error(`[runImport] Exception for row ${i + j + 1}:`, err);
                result.errors.push({ row: i + j + 1, error: err.message || "Unknown error" });
                result.skipped++;
              }
            }
          }
        } else {
          result.inserted += batch.length;
        }
      } catch (err: any) {
        result.errors.push({ row: i + 1, error: err.message || "Unknown error" });
        result.skipped += batch.length;
      }
    }
  }

  return result;
}

/**
 * Filter a row to only include columns that exist in the fields definition
 * This is critical to prevent inserting columns that don't exist in the table
 */
function filterRowToExistingColumns(
  row: any,
  fields: Field[],
  upsertKey: string
): any {
  // Create a set of valid field keys for fast lookup
  const fieldKeys = new Set(fields.map(f => f.field_key));
  
  // Standard columns that might exist in any table
  const standardColumns = new Set(['id', 'created_at', 'updated_at']);
  if (upsertKey) {
    standardColumns.add(upsertKey);
  }
  
  const filtered: any = {};
  
  // Only include keys that are either:
  // 1. In the fields list (valid table columns)
  // 2. Standard columns (id, created_at, updated_at, upsertKey)
  for (const key of Object.keys(row)) {
    // Skip if value is null or undefined (but allow empty strings)
    if (row[key] === null || row[key] === undefined) {
      continue;
    }
    
    // Only include if it's a known field or standard column
    const isValidField = fieldKeys.has(key);
    const isStandardColumn = standardColumns.has(key);
    
    if (isValidField || isStandardColumn) {
      // For multi_select fields, ensure proper array format
      const field = fields.find(f => f.field_key === key);
      if (field?.type === 'multi_select') {
        // Ensure it's a proper array
        if (Array.isArray(row[key])) {
          filtered[key] = row[key];
        } else if (typeof row[key] === 'string') {
          // Try to parse as array if it's a string
          try {
            // Handle comma-separated values
            if (row[key].includes(',')) {
              filtered[key] = row[key].split(',').map((v: string) => v.trim()).filter(Boolean);
            } else {
              // Single value as array
              filtered[key] = [row[key].trim()].filter(Boolean);
            }
          } catch (e) {
            // If parsing fails, skip this field
            console.warn(`[filterRowToExistingColumns] Could not parse multi_select value for ${key}:`, row[key]);
          }
        }
      } else {
        filtered[key] = row[key];
      }
    } else {
      // Log skipped columns for debugging
      console.debug(`[filterRowToExistingColumns] Skipping column '${key}' - not found in table fields`);
    }
  }
  
  return filtered;
}

/**
 * Add unknown select options to field metadata
 */
async function addUnknownSelectOptions(
  rows: any[],
  mappings: FieldMapping[],
  fields: Field[]
): Promise<void> {
  // Find all single_select and multi_select fields
  const selectFields = fields.filter(
    (f) => f.type === "single_select" || f.type === "multi_select"
  );

  for (const field of selectFields) {
    const mapping = mappings.find((m) => m.fieldId === field.id);
    if (!mapping || !mapping.csvColumn) continue;

    const options = field.options?.values || [];
    const existingIds = new Set(options.map((opt: any) => opt.id));
    const existingLabels = new Set(
      options.map((opt: any) => opt.label?.toLowerCase())
    );

    const newOptions: any[] = [];

    // Collect unique values from rows
    for (const row of rows) {
      const value = row[field.field_key];
      if (!value) continue;

      if (field.type === "single_select") {
        const strValue = String(value);
        if (!existingIds.has(strValue) && !existingLabels.has(strValue.toLowerCase())) {
          if (!newOptions.find((opt) => opt.id === strValue || opt.label === strValue)) {
            newOptions.push({
              id: strValue.toLowerCase().replace(/\s+/g, "_"),
              label: strValue,
            });
          }
        }
      } else if (field.type === "multi_select" && Array.isArray(value)) {
        for (const item of value) {
          const strValue = String(item);
          if (!existingIds.has(strValue) && !existingLabels.has(strValue.toLowerCase())) {
            if (!newOptions.find((opt) => opt.id === strValue || opt.label === strValue)) {
              newOptions.push({
                id: strValue.toLowerCase().replace(/\s+/g, "_"),
                label: strValue,
              });
            }
          }
        }
      }
    }

    // Add new options to field
    if (newOptions.length > 0) {
      const updatedOptions = {
        values: [...options, ...newOptions],
      };

      await supabase
        .from("table_fields")
        .update({ options: JSON.stringify(updatedOptions) })
        .eq("id", field.id);
    }
  }
}

