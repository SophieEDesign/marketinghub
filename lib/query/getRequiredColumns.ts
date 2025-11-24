import { Field } from "../fields";

/**
 * Known columns that don't exist in the database but might be in field definitions
 * These will be filtered out to prevent query errors
 * Note: Linked record fields like 'briefings' and 'documents' are relationships,
 * not actual columns, so they should be queried via joins or separate queries
 */
const INVALID_COLUMNS = new Set([
  'track',
  'content_name',
  'date_to',
  'date_due',
  'content_folder_canva',
  'briefings', // This is a linked table relationship, not a column
  'documents', // This is a linked table relationship, not a column
]);

/**
 * Get required columns for a table query based on visible fields
 * This optimizes Supabase queries by selecting only needed columns
 */
export function getRequiredColumns(fields: Field[], includeId: boolean = true): string {
  const columns = new Set<string>();
  
  if (includeId) {
    columns.add("id");
  }

  // Add all visible field keys, but filter out invalid/non-existent columns
  fields.forEach((field) => {
    if (field.visible !== false && !INVALID_COLUMNS.has(field.field_key)) {
      columns.add(field.field_key);
    }
  });

  // Always include common metadata fields
  columns.add("created_at");
  columns.add("updated_at");

  return Array.from(columns).join(", ");
}

/**
 * Get minimal columns for list views (Grid, Kanban, Cards)
 */
export function getMinimalColumns(tableId: string, fields: Field[]): string {
  const columns = new Set<string>();
  columns.add("id");

  // Get title/name field
  const titleField = fields.find(
    (f) =>
      (f.field_key === "title" || f.field_key === "name") &&
      f.visible !== false &&
      !INVALID_COLUMNS.has(f.field_key)
  );
  if (titleField) columns.add(titleField.field_key);

  // Get status field
  const statusField = fields.find(
    (f) => 
      f.type === "single_select" && 
      f.label.toLowerCase().includes("status") &&
      !INVALID_COLUMNS.has(f.field_key)
  );
  if (statusField) columns.add(statusField.field_key);

  // Get date field (publish_date, due_date, etc.)
  const dateField = fields.find(
    (f) =>
      f.type === "date" &&
      (f.field_key.includes("date") || f.field_key.includes("Date")) &&
      !INVALID_COLUMNS.has(f.field_key)
  );
  if (dateField) columns.add(dateField.field_key);

  // Get thumbnail/attachment field
  const thumbnailField = fields.find(
    (f) => f.type === "attachment" && f.visible !== false && !INVALID_COLUMNS.has(f.field_key)
  );
  if (thumbnailField) columns.add(thumbnailField.field_key);

  // Get linked record fields
  fields
    .filter((f) => f.type === "linked_record" && f.visible !== false && !INVALID_COLUMNS.has(f.field_key))
    .forEach((f) => columns.add(f.field_key));

  // Get multi-select fields (channels, etc.)
  fields
    .filter((f) => f.type === "multi_select" && f.visible !== false && !INVALID_COLUMNS.has(f.field_key))
    .forEach((f) => columns.add(f.field_key));

  columns.add("created_at");
  columns.add("updated_at");

  return Array.from(columns).join(", ");
}

