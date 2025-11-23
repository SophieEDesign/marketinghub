import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = 'force-dynamic';

// GET /api/tables/[id]/fields - Get all fields for a table
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabase
      .from("table_fields")
      .select("*")
      .eq("table_id", params.id)
      .order("order", { ascending: true });

    if (error) {
      console.error("Error fetching fields:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("Error in GET /api/tables/[id]/fields:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

// POST /api/tables/[id]/fields - Create a new field
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, label, type, options, required, unique_field, order } = body;

    if (!name || !label || !type) {
      return NextResponse.json(
        { error: "Name, label, and type are required" },
        { status: 400 }
      );
    }

    // Validate name format
    if (!/^[a-z0-9_]+$/.test(name)) {
      return NextResponse.json(
        { error: "Field name must be lowercase, alphanumeric, and may contain underscores" },
        { status: 400 }
      );
    }

    // Get the table to get its name
    const { data: table, error: tableError } = await supabase
      .from("tables")
      .select("name")
      .eq("id", params.id)
      .single();

    if (tableError || !table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    // Create the field metadata
    const { data: field, error: fieldError } = await supabase
      .from("table_fields")
      .insert({
        table_id: params.id,
        name,
        label,
        type,
        options: options || {},
        required: required || false,
        unique_field: unique_field || false,
        order: order || 0,
      })
      .select()
      .single();

    if (fieldError) {
      console.error("Error creating field:", fieldError);
      return NextResponse.json({ error: fieldError.message }, { status: 500 });
    }

    // Add the column to the actual Supabase table
    // This requires admin privileges - for now, we'll just create the metadata
    // The actual column addition should be done via a database function or admin API
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // Determine column type based on field type
      let columnType = 'TEXT';
      switch (type) {
        case 'number':
          columnType = 'NUMERIC';
          break;
        case 'date':
        case 'datetime':
          columnType = 'TIMESTAMPTZ';
          break;
        case 'checkbox':
          columnType = 'BOOLEAN';
          break;
        case 'single_select':
        case 'multi_select':
          columnType = 'JSONB';
          break;
        case 'attachment':
          columnType = 'TEXT'; // URL
          break;
        case 'linked_record':
          columnType = 'UUID';
          break;
        default:
          columnType = 'TEXT';
      }

      const alterTableSQL = `ALTER TABLE ${table.name} ADD COLUMN IF NOT EXISTS ${name} ${columnType};`;

      const { error: alterError } = await supabaseAdmin.rpc('exec_sql', {
        sql: alterTableSQL
      });

      if (alterError) {
        console.warn("Could not add column via RPC (this is expected if RPC doesn't exist):", alterError);
        // Column addition will need to be done manually or via a database function
      }
    } catch (alterError: any) {
      console.warn("Column addition skipped (requires manual setup or admin function):", alterError.message);
    }

    return NextResponse.json(field, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/tables/[id]/fields:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

