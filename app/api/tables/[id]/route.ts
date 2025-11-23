import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = 'force-dynamic';

// GET /api/tables/[id] - Get a single table with its fields
// Supports both UUID (new system) and table name (old system)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if id is a UUID (new system) or table name (old system)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id);
    
    let table: any = null;
    let tableError: any = null;

    if (isUUID) {
      // New system: Look up by UUID
      const result = await supabase
        .from("tables")
        .select("*")
        .eq("id", params.id)
        .single();
      table = result.data;
      tableError = result.error;
    } else {
      // Old system or table name: Look up by name
      const result = await supabase
        .from("tables")
        .select("*")
        .eq("name", params.id)
        .single();
      table = result.data;
      tableError = result.error;

      // If not found in new system, try old table_metadata
      if (tableError || !table) {
        const { data: oldTable, error: oldError } = await supabase
          .from("table_metadata")
          .select("table_name, display_name, description")
          .eq("table_name", params.id)
          .single();

        if (!oldError && oldTable) {
          // Convert old format to new format
          table = {
            id: oldTable.table_name, // Use table_name as id
            name: oldTable.table_name,
            label: oldTable.display_name,
            description: oldTable.description || '',
            icon: 'table',
            color: '#6366f1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          tableError = null;
        }
      }
    }

    if (tableError && !table) {
      // If it's a "not found" error (PGRST116), return 404
      if (tableError.code === 'PGRST116' || tableError.message?.includes('No rows')) {
        return NextResponse.json({ error: "Table not found" }, { status: 404 });
      }
      console.error("Error fetching table:", tableError);
      return NextResponse.json({ error: tableError.message || "Table not found" }, { status: 404 });
    }

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    // Fetch fields for this table
    let fields: any[] = [];
    const tableIdForFields = isUUID ? table.id : table.id || table.name;
    
    if (tableIdForFields) {
      // Try to fetch fields using table_id (UUID) first
      const { data: fieldsData, error: fieldsError } = await supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", tableIdForFields)
        .order("order", { ascending: true });

      if (fieldsError) {
        // If that fails and we're using a table name, try to find the table by name first
        if (!isUUID && table.name) {
          const { data: tableByName } = await supabase
            .from("tables")
            .select("id")
            .eq("name", table.name)
            .single();
          
          if (tableByName?.id) {
            // Try again with the UUID
            const { data: fieldsData2, error: fieldsError2 } = await supabase
              .from("table_fields")
              .select("*")
              .eq("table_id", tableByName.id)
              .order("order", { ascending: true });
            
            if (!fieldsError2 && fieldsData2) {
              fields = fieldsData2;
            }
          }
        }
        
        if (fields.length === 0) {
          console.error("Error fetching fields:", fieldsError);
          // Don't fail if fields don't exist yet - return empty array
        }
      } else {
        fields = fieldsData || [];
      }
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

