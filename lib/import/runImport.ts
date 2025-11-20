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
          result.errors.push({ row: i + 1, error: `Check failed: ${checkError.message}` });
          result.skipped++;
          continue;
        }

        if (existing) {
          // Update existing
          const { error: updateError } = await supabase
            .from(options.tableId)
            .update(row)
            .eq(upsertKey, row[upsertKey]);

          if (updateError) {
            result.errors.push({ row: i + 1, error: `Update failed: ${updateError.message}` });
            result.skipped++;
          } else {
            result.updated++;
          }
        } else {
          // Insert new
          const { error: insertError } = await supabase
            .from(options.tableId)
            .insert([row]);

          if (insertError) {
            result.errors.push({ row: i + 1, error: `Insert failed: ${insertError.message}` });
            result.skipped++;
          } else {
            result.inserted++;
          }
        }
      } catch (err: any) {
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
        const { error: insertError } = await supabase
          .from(options.tableId)
          .insert(batch);

        if (insertError) {
          // If batch fails, try individual inserts
          for (let j = 0; j < batch.length; j++) {
            try {
              const { error: singleError } = await supabase
                .from(options.tableId)
                .insert([batch[j]]);

              if (singleError) {
                result.errors.push({ row: i + j + 1, error: singleError.message });
                result.skipped++;
              } else {
                result.inserted++;
              }
            } catch (err: any) {
              result.errors.push({ row: i + j + 1, error: err.message || "Unknown error" });
              result.skipped++;
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

