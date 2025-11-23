import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = 'force-dynamic';

// GET /api/tables/[id] - Get a single table with its fields
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: table, error: tableError } = await supabase
      .from("tables")
      .select("*")
      .eq("id", params.id)
      .single();

    if (tableError) {
      console.error("Error fetching table:", tableError);
      return NextResponse.json({ error: tableError.message }, { status: 500 });
    }

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    // Fetch fields for this table
    const { data: fields, error: fieldsError } = await supabase
      .from("table_fields")
      .select("*")
      .eq("table_id", params.id)
      .order("order", { ascending: true });

    if (fieldsError) {
      console.error("Error fetching fields:", fieldsError);
      // Don't fail if fields don't exist yet
    }

    return NextResponse.json({
      ...table,
      fields: fields || [],
    });
  } catch (error: any) {
    console.error("Error in GET /api/tables/[id]:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

// PUT /api/tables/[id] - Update a table
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { label, description, icon, color } = body;

    const updates: any = {};
    if (label !== undefined) updates.label = label;
    if (description !== undefined) updates.description = description;
    if (icon !== undefined) updates.icon = icon;
    if (color !== undefined) updates.color = color;

    const { data, error } = await supabase
      .from("tables")
      .update(updates)
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating table:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error in PUT /api/tables/[id]:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/tables/[id] - Delete a table
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // First get the table to get its name
    const { data: table, error: tableError } = await supabase
      .from("tables")
      .select("name")
      .eq("id", params.id)
      .single();

    if (tableError || !table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    // Delete the table metadata (cascade will delete fields)
    const { error: deleteError } = await supabase
      .from("tables")
      .delete()
      .eq("id", params.id);

    if (deleteError) {
      console.error("Error deleting table:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Note: The actual Supabase table should be dropped separately
    // This requires admin privileges and should be done via a database function
    // For now, we just delete the metadata

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in DELETE /api/tables/[id]:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

