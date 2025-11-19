import { FieldType } from "@/lib/fields";

/**
 * Auto-detect field type based on CSV values
 */
export function detectFieldType(values: string[]): FieldType {
  if (values.length === 0) return "text";

  const nonEmptyValues = values.filter((v) => v && v.trim() !== "");
  if (nonEmptyValues.length === 0) return "text";

  // Check for boolean
  const booleanPattern = /^(true|false|yes|no|1|0|y|n)$/i;
  if (nonEmptyValues.every((v) => booleanPattern.test(v.trim()))) {
    return "boolean";
  }

  // Check for number
  const numberPattern = /^-?\d+(\.\d+)?$/;
  if (nonEmptyValues.every((v) => numberPattern.test(v.trim()))) {
    return "number";
  }

  // Check for date
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
    /^\d{2}\/\d{2}\/\d{2}$/, // MM/DD/YY
    /^\d{4}\/\d{2}\/\d{2}$/, // YYYY/MM/DD
    /^\d{2}-\d{2}-\d{4}$/, // MM-DD-YYYY
  ];
  if (nonEmptyValues.every((v) => datePatterns.some((pattern) => pattern.test(v.trim())))) {
    return "date";
  }

  // Check for URL (attachment)
  const urlPattern = /^https?:\/\/.+/i;
  if (nonEmptyValues.every((v) => urlPattern.test(v.trim()))) {
    return "attachment";
  }

  // Check for multi-select (comma-separated)
  const hasCommas = nonEmptyValues.some((v) => v.includes(","));
  if (hasCommas && nonEmptyValues.length > 2) {
    return "multi_select";
  }

  // Check for single-select (limited unique values)
  const uniqueValues = new Set(nonEmptyValues.map((v) => v.trim().toLowerCase()));
  if (uniqueValues.size <= 10 && nonEmptyValues.length >= 3) {
    return "single_select";
  }

  // Check for long text (longer strings)
  const avgLength = nonEmptyValues.reduce((sum, v) => sum + v.length, 0) / nonEmptyValues.length;
  if (avgLength > 100) {
    return "long_text";
  }

  return "text";
}

/**
 * Suggest field type based on column name
 */
export function suggestTypeFromColumnName(columnName: string): FieldType {
  const lower = columnName.toLowerCase();
  
  if (lower.includes("date") || lower.includes("time")) return "date";
  if (lower.includes("email")) return "text";
  if (lower.includes("url") || lower.includes("link") || lower.includes("image") || lower.includes("photo")) return "attachment";
  if (lower.includes("status") || lower.includes("state") || lower.includes("type")) return "single_select";
  if (lower.includes("tags") || lower.includes("categories") || lower.includes("channels")) return "multi_select";
  if (lower.includes("description") || lower.includes("notes") || lower.includes("body") || lower.includes("content")) return "long_text";
  if (lower.includes("count") || lower.includes("number") || lower.includes("amount") || lower.includes("price")) return "number";
  if (lower.includes("active") || lower.includes("enabled") || lower.includes("published")) return "boolean";
  
  return "text";
}

