import { supabase } from "./supabaseClient";

export type FieldType =
  | "text"
  | "long_text"
  | "date"
  | "single_select"
  | "multi_select"
  | "number"
  | "boolean"
  | "attachment"
  | "linked_record";

export interface FieldOption {
  id: string;
  label: string;
  color?: string;
}

export interface Field {
  id: string;
  table_id: string;
  field_key: string;
  label: string;
  type: FieldType;
  options?: FieldOption[] | any; // JSON field
  order: number;
  required: boolean;
  visible?: boolean;
}

export interface FieldMetadata {
  [fieldKey: string]: Field;
}

/**
 * Load all fields for a table from Supabase table_fields table
 */
export async function loadFields(tableId: string): Promise<Field[]> {
  const { data, error } = await supabase
    .from("table_fields")
    .select("*")
    .eq("table_id", tableId)
    .order("order", { ascending: true });

  if (error) {
    console.error("Error loading fields:", error);
    // Fallback to defaults if table_fields doesn't exist yet
    return getDefaultFieldsForTable(tableId);
  }

  if (!data || data.length === 0) {
    return getDefaultFieldsForTable(tableId);
  }

  // Parse and deduplicate fields by field_key (keep the first occurrence)
  const seenKeys = new Set<string>();
  const uniqueFields = (data || [])
    .map((f) => ({
      ...f,
      options: typeof f.options === "string" ? JSON.parse(f.options) : f.options,
    }))
    .filter((f) => {
      if (seenKeys.has(f.field_key)) {
        console.warn(`Duplicate field_key "${f.field_key}" found in table_fields for table "${tableId}". Keeping first occurrence.`);
        return false;
      }
      seenKeys.add(f.field_key);
      return true;
    }) as Field[];

  return uniqueFields;
}

/**
 * Get default fields for content table based on existing schema
 */
function getDefaultFieldsForTable(tableId: string): Field[] {
  if (tableId === "content") {
    return [
      { id: "1", table_id: "content", field_key: "id", label: "ID", type: "text", order: 0, required: true, visible: false },
      { id: "2", table_id: "content", field_key: "title", label: "Title", type: "text", order: 1, required: true, visible: true },
      { id: "3", table_id: "content", field_key: "description", label: "Description", type: "long_text", order: 2, required: false, visible: true },
      { id: "4", table_id: "content", field_key: "status", label: "Status", type: "single_select", order: 3, required: false, visible: true, options: [
        { id: "todo", label: "To Do" },
        { id: "awaiting", label: "Awaiting Information" },
        { id: "in_progress", label: "In Progress" },
        { id: "needs_update", label: "Needs Update" },
        { id: "drafted", label: "Drafted – Needs Internal Review" },
        { id: "sent_approval", label: "Sent for Approval – Internal (P&M)" },
        { id: "tech_check", label: "Tech Check Required" },
        { id: "text_approved", label: "Text Approved – Image Needed" },
        { id: "approved", label: "Approved – Ready to Schedule" },
        { id: "scheduled", label: "Scheduled" },
        { id: "completed", label: "Completed (Published)" },
        { id: "event_passed", label: "Event Passed / Out of Date" },
        { id: "monthly", label: "Monthly (Recurring)" },
        { id: "ideas", label: "Ideas" },
        { id: "dates_engagement", label: "Dates for Engagement" },
        { id: "date_confirmed", label: "Date Confirmed" },
        { id: "on_hold", label: "On Hold" },
        { id: "duplicate", label: "Duplicate" },
        { id: "cancelled", label: "Cancelled" },
      ]},
      { id: "5", table_id: "content", field_key: "channels", label: "Channels", type: "multi_select", order: 4, required: false, visible: true },
      { id: "6", table_id: "content", field_key: "content_type", label: "Content Type", type: "text", order: 5, required: false, visible: true },
      { id: "7", table_id: "content", field_key: "publish_date", label: "Publish Date", type: "date", order: 6, required: false, visible: true },
      { id: "8", table_id: "content", field_key: "thumbnail_url", label: "Thumbnail", type: "attachment", order: 7, required: false, visible: true },
      { id: "9", table_id: "content", field_key: "campaign_id", label: "Campaign", type: "linked_record", order: 8, required: false, visible: true },
      { id: "10", table_id: "content", field_key: "created_at", label: "Created At", type: "date", order: 9, required: false, visible: false },
      { id: "11", table_id: "content", field_key: "updated_at", label: "Updated At", type: "date", order: 10, required: false, visible: false },
    ];
  }
  
  // For other tables, return empty array (they can be configured via Field Manager)
  return [];
}

/**
 * Get a single field by field_key
 */
export async function getField(tableId: string, fieldKey: string): Promise<Field | null> {
  const fields = await loadFields(tableId);
  return fields.find((f) => f.field_key === fieldKey) || null;
}

/**
 * Save fields for a table to table_fields (not used directly, use useFieldManager instead)
 * This is kept for backward compatibility
 */
export async function saveFields(tableId: string, fields: Field[]): Promise<boolean> {
  // This function is deprecated - use useFieldManager hook instead
  console.warn("saveFields is deprecated, use useFieldManager hook instead");
  return false;
}

/**
 * Create a new field (use useFieldManager.addField instead)
 */
export async function createField(tableId: string, field: Omit<Field, "id" | "table_id">): Promise<Field | null> {
  // This function is deprecated - use useFieldManager hook instead
  console.warn("createField is deprecated, use useFieldManager.addField instead");
  
  const fieldKey = field.field_key || field.label.toLowerCase().replace(/\s+/g, "_");
  const fields = await loadFields(tableId);
  const maxOrder = fields.length > 0 ? Math.max(...fields.map((f) => f.order)) : -1;
  
  let optionsValue: any = null;
  if (field.type === "single_select" || field.type === "multi_select") {
    optionsValue = { values: [] };
  }

  const { data, error } = await supabase
    .from("table_fields")
    .insert([
      {
        table_id: tableId,
        field_key: fieldKey,
        label: field.label,
        type: field.type,
        options: optionsValue ? JSON.stringify(optionsValue) : null,
        order: maxOrder + 1,
        required: field.required || false,
        visible: field.visible ?? true,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Error creating field:", error);
    return null;
  }

  return {
    ...data,
    options: optionsValue,
  } as Field;
}

/**
 * Update a field (use useFieldManager.updateField instead)
 */
export async function updateField(
  tableId: string,
  fieldId: string,
  updates: Partial<Omit<Field, "id" | "table_id" | "field_key">>
): Promise<Field | null> {
  const updateData: any = { ...updates };
  if (updateData.options && typeof updateData.options === "object") {
    updateData.options = JSON.stringify(updateData.options);
  }

  const { data, error } = await supabase
    .from("table_fields")
    .update(updateData)
    .eq("id", fieldId)
    .select()
    .single();

  if (error) {
    console.error("Error updating field:", error);
    return null;
  }

  return {
    ...data,
    options: typeof data.options === "string" ? JSON.parse(data.options) : data.options,
  } as Field;
}

/**
 * Delete a field (use useFieldManager.deleteField instead)
 */
export async function deleteField(tableId: string, fieldId: string): Promise<boolean> {
  const { error } = await supabase
    .from("table_fields")
    .delete()
    .eq("id", fieldId);

  if (error) {
    console.error("Error deleting field:", error);
    return false;
  }

  return true;
}

/**
 * Reorder fields (use useFieldManager.reorderFields instead)
 */
export async function reorderFields(tableId: string, fieldIds: string[]): Promise<boolean> {
  const updates = fieldIds.map((id, index) => ({
    id,
    order: index,
  }));

  for (const update of updates) {
    const { error } = await supabase
      .from("table_fields")
      .update({ order: update.order })
      .eq("id", update.id);

    if (error) {
      console.error("Error reordering fields:", error);
      return false;
    }
  }

  return true;
}

/**
 * Get field metadata as a map for quick lookups
 */
export async function getFieldsMap(tableId: string): Promise<FieldMetadata> {
  const fields = await loadFields(tableId);
  const map: FieldMetadata = {};
  fields.forEach((field) => {
    map[field.field_key] = field;
  });
  return map;
}

/**
 * Get visible fields only
 */
export async function getVisibleFields(tableId: string): Promise<Field[]> {
  const fields = await loadFields(tableId);
  return fields.filter((f) => f.visible !== false);
}
