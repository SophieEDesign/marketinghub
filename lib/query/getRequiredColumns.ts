import { Field } from "../fields";

/**
 * Get required columns for a table query based on visible fields
 * This optimizes Supabase queries by selecting only needed columns
 */
export function getRequiredColumns(fields: Field[], includeId: boolean = true): string {
  const columns = new Set<string>();
  
  if (includeId) {
    columns.add("id");
  }

  // Add all visible field keys
  fields.forEach((field) => {
    if (field.visible !== false) {
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
      f.visible !== false
  );
  if (titleField) columns.add(titleField.field_key);

  // Get status field
  const statusField = fields.find(
    (f) => f.type === "single_select" && f.label.toLowerCase().includes("status")
  );
  if (statusField) columns.add(statusField.field_key);

  // Get date field (publish_date, due_date, etc.)
  const dateField = fields.find(
    (f) =>
      f.type === "date" &&
      (f.field_key.includes("date") || f.field_key.includes("Date"))
  );
  if (dateField) columns.add(dateField.field_key);

  // Get thumbnail/attachment field
  const thumbnailField = fields.find(
    (f) => f.type === "attachment" && f.visible !== false
  );
  if (thumbnailField) columns.add(thumbnailField.field_key);

  // Get linked record fields
  fields
    .filter((f) => f.type === "linked_record" && f.visible !== false)
    .forEach((f) => columns.add(f.field_key));

  // Get multi-select fields (channels, etc.)
  fields
    .filter((f) => f.type === "multi_select" && f.visible !== false)
    .forEach((f) => columns.add(f.field_key));

  columns.add("created_at");
  columns.add("updated_at");

  return Array.from(columns).join(", ");
}

