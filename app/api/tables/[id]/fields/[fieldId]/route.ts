import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = 'force-dynamic';

/**
 * Resolve table ID from either UUID or table name
 */
async function resolveTableId(id: string): Promise<string | null> {
  // Check if id is a UUID (new system) or table name (old system)
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  
  if (isUUID) {
    // New system: Verify UUID exists
    const { data, error } = await supabase
      .from("tables")
      .select("id")
      .eq("id", id)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data.id;
  } else {
    // Old system or table name: Look up by name
    const { data, error } = await supabase
      .from("tables")
      .select("id")
      .eq("name", id)
      .single();
    
    if (error || !data) {
      // Try old table_metadata as fallback
      const { data: oldTable } = await supabase
        .from("table_metadata")
        .select("table_name")
        .eq("table_name", id)
        .single();
      
      if (oldTable) {
        // For old system, use table_name as the ID
        return oldTable.table_name;
      }
      
      return null;
    }
    
    return data.id;
  }
}

// DELETE /api/tables/[id]/fields/[fieldId] - Delete a field
// Supports both UUID (new system) and table name (old system)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; fieldId: string } }
) {
  try {
    // Resolve table ID
    const tableId = await resolveTableId(params.id);
    
    if (!tableId) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }
    
    // Get the field to get its name
    const { data: field, error: fieldError } = await supabase
      .from("table_fields")
      .select("name, table_id")
      .eq("id", params.fieldId)
      .single();

    if (fieldError || !field) {
      return NextResponse.json({ error: "Field not found" }, { status: 404 });
    }

    // Verify it belongs to this table
    if (field.table_id !== tableId) {
      return NextResponse.json({ error: "Field does not belong to this table" }, { status: 400 });
    }

    // Delete the field metadata
    const { error: deleteError } = await supabase
      .from("table_fields")
      .delete()
      .eq("id", params.fieldId);

    if (deleteError) {
      console.error("Error deleting field:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Note: The actual column should be dropped from the table
    // This requires admin privileges and should be done via a database function
    // For now, we just delete the metadata

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in DELETE /api/tables/[id]/fields/[fieldId]:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

