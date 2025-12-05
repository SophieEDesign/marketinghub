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

  if (tableId === "campaigns") {
    return [
      { id: "c1", table_id: "campaigns", field_key: "id", label: "ID", type: "text", order: 0, required: true, visible: false },
      { id: "c2", table_id: "campaigns", field_key: "name", label: "Name", type: "text", order: 1, required: true, visible: true },
      { id: "c3", table_id: "campaigns", field_key: "description", label: "Description", type: "long_text", order: 2, required: false, visible: true },
      { id: "c4", table_id: "campaigns", field_key: "status", label: "Status", type: "single_select", order: 3, required: false, visible: true, options: { values: [
        { id: "planning", label: "Planning" },
        { id: "active", label: "Active" },
        { id: "completed", label: "Completed" },
        { id: "cancelled", label: "Cancelled" },
      ]}},
      { id: "c5", table_id: "campaigns", field_key: "colour", label: "Colour", type: "text", order: 4, required: false, visible: true },
      { id: "c6", table_id: "campaigns", field_key: "start_date", label: "Start Date", type: "date", order: 5, required: false, visible: true },
      { id: "c7", table_id: "campaigns", field_key: "end_date", label: "End Date", type: "date", order: 6, required: false, visible: true },
      { id: "c8", table_id: "campaigns", field_key: "created_at", label: "Created At", type: "date", order: 7, required: false, visible: false },
      { id: "c9", table_id: "campaigns", field_key: "updated_at", label: "Updated At", type: "date", order: 8, required: false, visible: false },
    ];
  }

  if (tableId === "contacts") {
    return [
      { id: "ct1", table_id: "contacts", field_key: "id", label: "ID", type: "text", order: 0, required: true, visible: false },
      { id: "ct2", table_id: "contacts", field_key: "name", label: "Name", type: "text", order: 1, required: true, visible: true },
      { id: "ct3", table_id: "contacts", field_key: "email", label: "Email", type: "text", order: 2, required: false, visible: true },
      { id: "ct4", table_id: "contacts", field_key: "phone", label: "Phone", type: "text", order: 3, required: false, visible: true },
      { id: "ct5", table_id: "contacts", field_key: "company", label: "Company", type: "text", order: 4, required: false, visible: true },
      { id: "ct6", table_id: "contacts", field_key: "notes", label: "Notes", type: "long_text", order: 5, required: false, visible: true },
      { id: "ct7", table_id: "contacts", field_key: "created_at", label: "Created At", type: "date", order: 6, required: false, visible: false },
      { id: "ct8", table_id: "contacts", field_key: "updated_at", label: "Updated At", type: "date", order: 7, required: false, visible: false },
    ];
  }

  if (tableId === "ideas") {
    return [
      { id: "i1", table_id: "ideas", field_key: "id", label: "ID", type: "text", order: 0, required: true, visible: false },
      { id: "i2", table_id: "ideas", field_key: "title", label: "Title", type: "text", order: 1, required: true, visible: true },
      { id: "i3", table_id: "ideas", field_key: "description", label: "Description", type: "long_text", order: 2, required: false, visible: true },
      { id: "i4", table_id: "ideas", field_key: "category", label: "Category", type: "single_select", order: 3, required: false, visible: true, options: { values: [
        { id: "social", label: "Social Media" },
        { id: "blog", label: "Blog" },
        { id: "email", label: "Email" },
        { id: "event", label: "Event" },
        { id: "other", label: "Other" },
      ]}},
      { id: "i5", table_id: "ideas", field_key: "status", label: "Status", type: "single_select", order: 4, required: false, visible: true, options: { values: [
        { id: "idea", label: "Idea" },
        { id: "draft", label: "Draft" },
        { id: "ready", label: "Ready" },
        { id: "completed", label: "Completed" },
      ]}},
      { id: "i6", table_id: "ideas", field_key: "created_at", label: "Created At", type: "date", order: 5, required: false, visible: false },
      { id: "i7", table_id: "ideas", field_key: "updated_at", label: "Updated At", type: "date", order: 6, required: false, visible: false },
    ];
  }

  if (tableId === "media") {
    return [
      { id: "m1", table_id: "media", field_key: "id", label: "ID", type: "text", order: 0, required: true, visible: false },
      { id: "m2", table_id: "media", field_key: "publication", label: "Publication", type: "text", order: 1, required: true, visible: true },
      { id: "m3", table_id: "media", field_key: "url", label: "URL", type: "text", order: 2, required: false, visible: true },
      { id: "m4", table_id: "media", field_key: "date", label: "Date", type: "date", order: 3, required: false, visible: true },
      { id: "m5", table_id: "media", field_key: "notes", label: "Notes", type: "long_text", order: 4, required: false, visible: true },
      { id: "m6", table_id: "media", field_key: "content_id", label: "Content", type: "linked_record", order: 5, required: false, visible: true },
      { id: "m7", table_id: "media", field_key: "created_at", label: "Created At", type: "date", order: 6, required: false, visible: false },
      { id: "m8", table_id: "media", field_key: "updated_at", label: "Updated At", type: "date", order: 7, required: false, visible: false },
    ];
  }

  if (tableId === "tasks") {
    return [
      { id: "t1", table_id: "tasks", field_key: "id", label: "ID", type: "text", order: 0, required: true, visible: false },
      { id: "t2", table_id: "tasks", field_key: "title", label: "Title", type: "text", order: 1, required: true, visible: true },
      { id: "t3", table_id: "tasks", field_key: "description", label: "Description", type: "long_text", order: 2, required: false, visible: true },
      { id: "t4", table_id: "tasks", field_key: "status", label: "Status", type: "single_select", order: 3, required: false, visible: true, options: { values: [
        { id: "todo", label: "To Do" },
        { id: "in_progress", label: "In Progress" },
        { id: "done", label: "Done" },
      ]}},
      { id: "t5", table_id: "tasks", field_key: "due_date", label: "Due Date", type: "date", order: 4, required: false, visible: true },
      { id: "t6", table_id: "tasks", field_key: "assigned_to", label: "Assigned To", type: "linked_record", order: 5, required: false, visible: true },
      { id: "t7", table_id: "tasks", field_key: "content_id", label: "Content", type: "linked_record", order: 6, required: false, visible: true },
      { id: "t8", table_id: "tasks", field_key: "campaign_id", label: "Campaign", type: "linked_record", order: 7, required: false, visible: true },
      { id: "t9", table_id: "tasks", field_key: "created_at", label: "Created At", type: "date", order: 8, required: false, visible: false },
      { id: "t10", table_id: "tasks", field_key: "updated_at", label: "Updated At", type: "date", order: 9, required: false, visible: false },
    ];
  }

  if (tableId === "briefings") {
    return [
      { id: "b1", table_id: "briefings", field_key: "id", label: "ID", type: "text", order: 0, required: true, visible: false },
      { id: "b2", table_id: "briefings", field_key: "title", label: "Title", type: "text", order: 1, required: true, visible: true },
      { id: "b3", table_id: "briefings", field_key: "notes", label: "Notes", type: "long_text", order: 2, required: false, visible: true },
      { id: "b4", table_id: "briefings", field_key: "content_id", label: "Content", type: "linked_record", order: 3, required: false, visible: true },
      { id: "b5", table_id: "briefings", field_key: "date", label: "Date", type: "date", order: 4, required: false, visible: true },
      { id: "b6", table_id: "briefings", field_key: "created_at", label: "Created At", type: "date", order: 5, required: false, visible: false },
      { id: "b7", table_id: "briefings", field_key: "updated_at", label: "Updated At", type: "date", order: 6, required: false, visible: false },
    ];
  }

  if (tableId === "sponsorships") {
    return [
      { id: "s1", table_id: "sponsorships", field_key: "id", label: "ID", type: "text", order: 0, required: true, visible: false },
      { id: "s2", table_id: "sponsorships", field_key: "name", label: "Name", type: "text", order: 1, required: true, visible: true },
      { id: "s3", table_id: "sponsorships", field_key: "notes", label: "Notes", type: "long_text", order: 2, required: false, visible: true },
      { id: "s4", table_id: "sponsorships", field_key: "start_date", label: "Start Date", type: "date", order: 3, required: false, visible: true },
      { id: "s5", table_id: "sponsorships", field_key: "end_date", label: "End Date", type: "date", order: 4, required: false, visible: true },
      { id: "s6", table_id: "sponsorships", field_key: "status", label: "Status", type: "single_select", order: 5, required: false, visible: true, options: { values: [
        { id: "pending", label: "Pending" },
        { id: "active", label: "Active" },
        { id: "completed", label: "Completed" },
        { id: "cancelled", label: "Cancelled" },
      ]}},
      { id: "s7", table_id: "sponsorships", field_key: "created_at", label: "Created At", type: "date", order: 6, required: false, visible: false },
      { id: "s8", table_id: "sponsorships", field_key: "updated_at", label: "Updated At", type: "date", order: 7, required: false, visible: false },
    ];
  }

  if (tableId === "strategy") {
    return [
      { id: "st1", table_id: "strategy", field_key: "id", label: "ID", type: "text", order: 0, required: true, visible: false },
      { id: "st2", table_id: "strategy", field_key: "title", label: "Title", type: "text", order: 1, required: true, visible: true },
      { id: "st3", table_id: "strategy", field_key: "details", label: "Details", type: "long_text", order: 2, required: false, visible: true },
      { id: "st4", table_id: "strategy", field_key: "category", label: "Category", type: "single_select", order: 3, required: false, visible: true, options: { values: [
        { id: "brand", label: "Brand" },
        { id: "content", label: "Content" },
        { id: "social", label: "Social" },
        { id: "seo", label: "SEO" },
        { id: "other", label: "Other" },
      ]}},
      { id: "st5", table_id: "strategy", field_key: "owner", label: "Owner", type: "linked_record", order: 4, required: false, visible: true },
      { id: "st6", table_id: "strategy", field_key: "created_at", label: "Created At", type: "date", order: 5, required: false, visible: false },
      { id: "st7", table_id: "strategy", field_key: "updated_at", label: "Updated At", type: "date", order: 6, required: false, visible: false },
    ];
  }

  if (tableId === "assets") {
    return [
      { id: "a1", table_id: "assets", field_key: "id", label: "ID", type: "text", order: 0, required: true, visible: false },
      { id: "a2", table_id: "assets", field_key: "filename", label: "Filename", type: "text", order: 1, required: true, visible: true },
      { id: "a3", table_id: "assets", field_key: "file_url", label: "File URL", type: "attachment", order: 2, required: true, visible: true },
      { id: "a4", table_id: "assets", field_key: "asset_type", label: "Asset Type", type: "single_select", order: 3, required: false, visible: true, options: { values: [
        { id: "image", label: "Image" },
        { id: "video", label: "Video" },
        { id: "document", label: "Document" },
        { id: "other", label: "Other" },
      ]}},
      { id: "a5", table_id: "assets", field_key: "content_id", label: "Content", type: "linked_record", order: 4, required: false, visible: true },
      { id: "a6", table_id: "assets", field_key: "uploaded_at", label: "Uploaded At", type: "date", order: 5, required: false, visible: false },
      { id: "a7", table_id: "assets", field_key: "created_at", label: "Created At", type: "date", order: 6, required: false, visible: false },
      { id: "a8", table_id: "assets", field_key: "updated_at", label: "Updated At", type: "date", order: 7, required: false, visible: false },
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
