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

// GET /api/tables/[id]/fields - Get all fields for a table
// Supports both UUID (new system) and table name (old system)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tableId = await resolveTableId(params.id);
    
    if (!tableId) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }
    
    // Query for fields - handle both cases where table_id might be UUID or table name
    // If tableId is a UUID but params.id was a name, also check for fields with that name
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tableId);
    
    let data: any[] = [];
    let error: any = null;
    
    // First, try querying with the resolved tableId
    const { data: fields1, error: error1 } = await supabase
      .from("table_fields")
      .select("*")
      .eq("table_id", tableId)
      .order("order", { ascending: true });
    
    if (error1) {
      error = error1;
    } else {
      data = fields1 || [];
    }
    
    // If we resolved to a UUID but the original param was a name, also check for fields with that name
    // (for backward compatibility with old system where fields might have table name as table_id)
    if (isUUID && params.id !== tableId && (!data || data.length === 0)) {
      const { data: fields2, error: error2 } = await supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", params.id)
        .order("order", { ascending: true });
      
      if (!error2 && fields2) {
        data = fields2;
        error = null;
      } else if (error2 && !error) {
        error = error2;
      }
    }

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
// Supports both UUID (new system) and table name (old system)
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

    // Resolve table ID and get table info
    const tableId = await resolveTableId(params.id);
    
    if (!tableId) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }
    
    // Get the table to get its name (for column creation)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tableId);
    let tableName: string;
    
    if (isUUID) {
      const { data: table, error: tableError } = await supabase
        .from("tables")
        .select("name")
        .eq("id", tableId)
        .single();

      if (tableError || !table) {
        return NextResponse.json({ error: "Table not found" }, { status: 404 });
      }
      
      tableName = table.name;
    } else {
      // Old system: tableId is the table name
      tableName = tableId;
    }

    // Create the field metadata
    // The database uses 'field_key' (this is what lib/fields.ts expects)
    const insertData: any = {
      table_id: tableId,
      field_key: name, // Use name as field_key
      label,
      type,
      options: options || {},
      required: required || false,
      visible: true, // Old system has visible field
      order: order || 0,
    };
    
    const { data: field, error: fieldError } = await supabase
      .from("table_fields")
      .insert(insertData)
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

      const alterTableSQL = `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${name} ${columnType};`;

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

