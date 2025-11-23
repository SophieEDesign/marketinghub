import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = 'force-dynamic';

// DELETE /api/tables/[id]/fields/[fieldId] - Delete a field
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; fieldId: string } }
) {
  try {
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
    if (field.table_id !== params.id) {
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

