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
    // Return empty array - new tables should have no default fields
    return [];
  }

  if (!data || data.length === 0) {
    // Return empty array - new tables should have no default fields
    // User will add fields as needed
    return [];
  }

  // Parse and deduplicate fields by field_key (keep the first occurrence)
  const seenKeys = new Set<string>();
  const seenIds = new Set<string>();
  const uniqueFields = (data || [])
    .map((f) => ({
      ...f,
      options: typeof f.options === "string" ? JSON.parse(f.options) : f.options,
    }))
    .filter((f) => {
      // Skip if no field_key
      if (!f.field_key) {
        console.warn(`Field ${f.id} has no field_key, skipping`);
        return false;
      }
      // Skip if duplicate ID
      if (seenIds.has(f.id)) {
        console.warn(`Duplicate field ID "${f.id}" found in table_fields for table "${tableId}". Skipping duplicate.`);
        return false;
      }
      seenIds.add(f.id);
      // Skip if duplicate field_key
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
 * Get default fields for a table
 * Returns empty array - new tables should have no default fields
 * User will add fields as needed
 */
function getDefaultFieldsForTable(tableId: string): Field[] {
  // All tables start with no fields - completely dynamic
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

  console.log("[fields] Creating field:", { tableId, fieldKey, field });

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
        // Note: visible column doesn't exist in table_fields - removed
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("[fields] Error creating field:", {
      error,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      tableId,
      fieldKey,
    });
    return null;
  }

  console.log("[fields] Field created successfully:", data);

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

  console.log("[fields] Updating field:", { tableId, fieldId, updates });

  const { data, error } = await supabase
    .from("table_fields")
    .update(updateData)
    .eq("id", fieldId)
    .select()
    .single();

  if (error) {
    console.error("[fields] Error updating field:", {
      error,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      tableId,
      fieldId,
    });
    return null;
  }

  console.log("[fields] Field updated successfully:", data);

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
