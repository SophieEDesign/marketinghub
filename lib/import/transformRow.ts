import { Field } from "@/lib/fields";
import dayjs from "dayjs";
import { supabase } from "@/lib/supabaseClient";

export interface FieldMapping {
  fieldId: string;
  fieldKey: string;
  csvColumn: string | null; // null means "Ignore"
  createNew?: boolean; // If true, create new field from CSV column
}

export interface TransformResult {
  row: any;
  warnings: string[];
  errors: string[];
}

/**
 * Transform a CSV row into a Supabase record based on field mappings
 */
export async function transformRow(
  csvRow: Record<string, string>,
  mappings: FieldMapping[],
  fields: Field[]
): Promise<TransformResult> {
  const result: any = {};
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const mapping of mappings) {
    if (!mapping.csvColumn || mapping.csvColumn === "IGNORE") {
      continue; // Skip ignored fields
    }

    const csvValue = csvRow[mapping.csvColumn];
    if (csvValue === undefined || csvValue === null) {
      continue; // Skip missing CSV columns
    }

    const field = fields.find((f) => f.id === mapping.fieldId);
    if (!field) {
      warnings.push(`Field ${mapping.fieldKey} not found in table_fields`);
      continue;
    }

    try {
      const transformedValue = await transformValue(csvValue, field, warnings, errors);
      if (transformedValue !== null && transformedValue !== undefined) {
        result[mapping.fieldKey] = transformedValue;
      }
    } catch (err: any) {
      errors.push(`Error transforming ${mapping.fieldKey}: ${err.message}`);
    }
  }

  return { row: result, warnings, errors };
}

/**
 * Transform a single CSV value to the correct type for a field
 */
async function transformValue(
  csvValue: string,
  field: Field,
  warnings: string[],
  errors: string[]
): Promise<any> {
  const trimmed = csvValue.trim();
  
  if (!trimmed || trimmed === "") {
    return null;
  }

  switch (field.type) {
    case "text":
      return trimmed;

    case "long_text":
      return trimmed;

    case "number":
      const num = parseFloat(trimmed);
      if (isNaN(num)) {
        warnings.push(`Invalid number: ${trimmed}`);
        return null;
      }
      return num;

    case "boolean":
      const lower = trimmed.toLowerCase();
      return lower === "true" || lower === "1" || lower === "yes" || lower === "y";

    case "date":
      const date = parseDate(trimmed);
      if (!date) {
        warnings.push(`Invalid date format: ${trimmed}`);
        return null;
      }
      return date.format("YYYY-MM-DD");

    case "single_select":
      return transformSingleSelect(trimmed, field, warnings);

    case "multi_select":
      return transformMultiSelect(trimmed, field, warnings);

    case "attachment":
      // If it's a URL, store it as-is (will be uploaded later if needed)
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return trimmed;
      }
      warnings.push(`Invalid URL for attachment: ${trimmed}`);
      return null;

    case "linked_record":
      // Look up the record in the foreign table by matching the display field
      const toTable = field.options?.to_table || field.options?.foreignTable;
      const displayField = field.options?.display_field || field.options?.displayField || "name";
      
      if (!toTable) {
        warnings.push(`Linked record field ${field.label} is not configured (missing to_table). Storing value as-is.`);
        return trimmed;
      }
      
      try {
        // Search for a record where the display field matches the CSV value
        let query: any = supabase
          .from(toTable)
          .select("id")
          .eq(displayField, trimmed)
          .limit(1);
        const { data, error } = await query.maybeSingle();
        
        if (error) {
          warnings.push(`Error looking up linked record in ${toTable} for "${trimmed}": ${error.message}. Storing value as-is.`);
          return trimmed;
        }
        
        if (data && data.id) {
          return String(data.id);
        } else {
          // No match found - try case-insensitive search
          let caseQuery: any = supabase
            .from(toTable)
            .select("id")
            .ilike(displayField, trimmed)
            .limit(1);
          const { data: caseInsensitiveData, error: caseError } = await caseQuery.maybeSingle();
          
          if (caseError) {
            warnings.push(`No match found in ${toTable} for "${trimmed}" (case-insensitive search failed). Storing value as-is.`);
            return trimmed;
          }
          
          if (caseInsensitiveData && caseInsensitiveData.id) {
            return String(caseInsensitiveData.id);
          } else {
            warnings.push(`No record found in ${toTable} matching "${trimmed}" in field "${displayField}". Storing value as-is. You may need to create the record first.`);
            return trimmed;
          }
        }
      } catch (err: any) {
        warnings.push(`Error looking up linked record: ${err.message}. Storing value as-is.`);
        return trimmed;
      }

    default:
      return trimmed;
  }
}

/**
 * Transform CSV value to single_select option ID
 */
function transformSingleSelect(
  value: string,
  field: Field,
  warnings: string[]
): string | null {
  const options = field.options?.values || [];
  
  // Try to find by label (case-insensitive)
  let option = options.find(
    (opt: any) => opt.label?.toLowerCase() === value.toLowerCase()
  );
  
  // Try to find by ID
  if (!option) {
    option = options.find((opt: any) => opt.id === value);
  }
  
  if (option) {
    return option.id;
  }
  
  // Option doesn't exist - we'll add it automatically
  warnings.push(`Unknown select option "${value}" for field ${field.label}. Will be added automatically.`);
  return value; // Return the value as-is, will be handled during import
}

/**
 * Transform CSV value to multi_select array of IDs
 */
function transformMultiSelect(
  value: string,
  field: Field,
  warnings: string[]
): string[] | null {
  if (!value || value.trim() === "") return null;
  
  // Handle different formats:
  // 1. Comma-separated: "Option1, Option2, Option3"
  // 2. Array-like string: "[Option1, Option2]"
  // 3. Single value: "Option1"
  
  let parts: string[] = [];
  
  // Try to parse as JSON array first
  if (value.trim().startsWith('[') && value.trim().endsWith(']')) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        parts = parsed.map((p) => String(p).trim()).filter(Boolean);
      }
    } catch (e) {
      // Not valid JSON, fall through to comma-split
    }
  }
  
  // If not parsed as JSON, split by comma
  if (parts.length === 0) {
    parts = value.split(",").map((p) => p.trim()).filter(Boolean);
  }
  
  if (parts.length === 0) return null;

  const options = field.options?.values || [];
  const result: string[] = [];

  for (const part of parts) {
    // Try to find by label (case-insensitive)
    let option = options.find(
      (opt: any) => opt.label?.toLowerCase() === part.toLowerCase()
    );
    
    // Try to find by ID
    if (!option) {
      option = options.find((opt: any) => opt.id === part || opt.id === part.toLowerCase().replace(/\s+/g, "_"));
    }
    
    if (option) {
      result.push(option.id);
    } else {
      // Unknown option - will be added automatically
      warnings.push(`Unknown multi-select option "${part}" for field ${field.label}. Will be added automatically.`);
      // Use a normalized ID format
      const normalizedId = part.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
      result.push(normalizedId || part); // Fallback to original if normalization fails
    }
  }

  return result.length > 0 ? result : null;
}

/**
 * Parse various date formats
 */
function parseDate(value: string): dayjs.Dayjs | null {
  // Try ISO format first
  let date = dayjs(value);
  if (date.isValid()) return date;

  // Try common formats
  const formats = [
    "MM/DD/YYYY",
    "DD/MM/YYYY",
    "YYYY-MM-DD",
    "MM-DD-YYYY",
    "DD-MM-YYYY",
    "YYYY/MM/DD",
  ];

  for (const format of formats) {
    date = dayjs(value, format);
    if (date.isValid()) return date;
  }

  return null;
}

