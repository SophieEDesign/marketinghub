import { FieldType } from "@/lib/fields";

/**
 * Auto-detect field type based on CSV values
 * Improved detection with better accuracy
 */
export function detectFieldType(values: string[]): FieldType {
  if (values.length === 0) return "text";

  const nonEmptyValues = values.filter((v) => v && v.trim() !== "");
  if (nonEmptyValues.length === 0) return "text";

  // Need at least 2-3 samples for reliable detection
  const sampleSize = Math.min(nonEmptyValues.length, 10);
  const samples = nonEmptyValues.slice(0, sampleSize);

  // Check for boolean (high confidence - all must match)
  const booleanPattern = /^(true|false|yes|no|1|0|y|n|on|off|enabled|disabled|active|inactive)$/i;
  const booleanMatches = samples.filter((v) => booleanPattern.test(v.trim())).length;
  if (booleanMatches === samples.length && samples.length >= 2) {
    return "boolean";
  }

  // Check for number (including decimals, percentages, currency)
  const numberPattern = /^-?\d+(\.\d+)?%?$|^\$?\d+(,\d{3})*(\.\d+)?$|^-?\d+\.\d+$/;
  const numberMatches = samples.filter((v) => {
    const cleaned = v.trim().replace(/[$,%]/g, '');
    return /^-?\d+(\.\d+)?$/.test(cleaned);
  }).length;
  // If 80%+ are numbers, consider it a number field
  if (numberMatches >= Math.ceil(samples.length * 0.8) && samples.length >= 2) {
    return "number";
  }

  // Check for date (multiple formats)
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/, // ISO format
    /^\d{4}\/\d{2}\/\d{2}/, // YYYY/MM/DD
    /^\d{2}\/\d{2}\/\d{4}/, // MM/DD/YYYY
    /^\d{2}\/\d{2}\/\d{2}/, // MM/DD/YY
    /^\d{2}-\d{2}-\d{4}/, // MM-DD-YYYY
    /^\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD
    /^[A-Z][a-z]{2}\s+\d{1,2},?\s+\d{4}/i, // "Jan 1, 2024"
  ];
  const dateMatches = samples.filter((v) => 
    datePatterns.some((pattern) => pattern.test(v.trim()))
  ).length;
  if (dateMatches >= Math.ceil(samples.length * 0.7) && samples.length >= 2) {
    return "date";
  }

  // Check for email
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailMatches = samples.filter((v) => emailPattern.test(v.trim())).length;
  if (emailMatches >= Math.ceil(samples.length * 0.8) && samples.length >= 2) {
    return "text"; // Email is stored as text
  }

  // Check for URL (attachment)
  const urlPattern = /^https?:\/\/.+/i;
  const urlMatches = samples.filter((v) => urlPattern.test(v.trim())).length;
  if (urlMatches >= Math.ceil(samples.length * 0.8) && samples.length >= 2) {
    return "attachment";
  }

  // Check for multi-select (comma-separated or semicolon-separated)
  const hasSeparators = samples.some((v) => /[,;]/.test(v.trim()));
  const separatorMatches = samples.filter((v) => /[,;]/.test(v.trim())).length;
  if (hasSeparators && separatorMatches >= Math.ceil(samples.length * 0.6) && samples.length >= 3) {
    return "multi_select";
  }

  // Check for single-select (limited unique values, high repetition)
  const uniqueValues = new Set(samples.map((v) => v.trim().toLowerCase()));
  const uniqueRatio = uniqueValues.size / samples.length;
  // If we have few unique values relative to sample size, likely a select
  if (uniqueValues.size <= 10 && uniqueRatio < 0.7 && samples.length >= 3) {
    return "single_select";
  }

  // Check for long text (longer strings)
  const avgLength = samples.reduce((sum, v) => sum + v.length, 0) / samples.length;
  if (avgLength > 100 && samples.length >= 2) {
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

