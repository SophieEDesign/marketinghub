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

  console.log("[runImport] Starting import:", { 
    tableId: options.tableId, 
    mode: options.mode, 
    upsertKey, 
    rowCount: transformedRows.length 
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
          // Remove columns that don't exist in the database
          // Filter out any columns that might cause errors
          const safeRow = { ...row };
          // Remove id from update (it's in the WHERE clause)
          delete safeRow.id;
          
          const { error: updateError } = await supabase
            .from(options.tableId)
            .update(safeRow)
            .eq("id", existing.id);

          if (updateError) {
            // If update fails due to missing columns, try to identify and remove them
            if (updateError.code === '42703' || updateError.message?.includes('does not exist')) {
              console.warn(`[runImport] Column doesn't exist, trying with minimal columns for row ${i + 1}`);
              // Try with only basic columns that should exist
              const minimalRow: any = {};
              if (safeRow[upsertKey] !== undefined) minimalRow[upsertKey] = safeRow[upsertKey];
              if (safeRow.created_at !== undefined) minimalRow.created_at = safeRow.created_at;
              if (safeRow.updated_at !== undefined) minimalRow.updated_at = safeRow.updated_at;
              
              const { error: minimalError } = await supabase
                .from(options.tableId)
                .update(minimalRow)
                .eq("id", existing.id);
              
              if (minimalError) {
                console.error(`[runImport] Update error for row ${i + 1}:`, minimalError);
                result.errors.push({ row: i + 1, error: `Update failed: ${minimalError.message}` });
                result.skipped++;
                continue;
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
          // Remove columns that might not exist
          const safeRow = { ...row };
          delete safeRow.id; // Don't insert id, let DB generate it
          
          const { error: insertError } = await supabase
            .from(options.tableId)
            .insert([safeRow]);

          if (insertError) {
            // If insert fails due to missing columns, try with minimal columns
            if (insertError.code === '42703' || insertError.message?.includes('does not exist')) {
              console.warn(`[runImport] Column doesn't exist, trying with minimal columns for row ${i + 1}`);
              const minimalRow: any = {};
              if (safeRow[upsertKey] !== undefined) minimalRow[upsertKey] = safeRow[upsertKey];
              if (safeRow.created_at !== undefined) minimalRow.created_at = safeRow.created_at;
              if (safeRow.updated_at !== undefined) minimalRow.updated_at = safeRow.updated_at;
              
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
        // Remove id from batch (let DB generate it)
        const safeBatch = batch.map(row => {
          const { id, ...rest } = row;
          return rest;
        });
        
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

