import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = 'force-dynamic';

// GET /api/tables - List all dynamic tables
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabase
      .from("tables")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching tables:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("Error in GET /api/tables:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

// POST /api/tables - Create a new dynamic table
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, label, description, icon, color } = body;

    if (!name || !label) {
      return NextResponse.json({ error: "Name and label are required" }, { status: 400 });
    }

    // Validate name format (lowercase, no spaces, alphanumeric + underscores)
    if (!/^[a-z0-9_]+$/.test(name)) {
      return NextResponse.json(
        { error: "Table name must be lowercase, alphanumeric, and may contain underscores" },
        { status: 400 }
      );
    }

    // Create the table in Supabase dynamically
    // First, create the metadata entry
    const { data: tableMeta, error: metaError } = await supabase
      .from("tables")
      .insert({
        name,
        label,
        description: description || '',
        icon: icon || 'table',
        color: color || '#6366f1',
      })
      .select()
      .single();

    if (metaError) {
      console.error("Error creating table metadata:", metaError);
      return NextResponse.json({ error: metaError.message }, { status: 500 });
    }

    // Create the actual Supabase table using the database function
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // Call the database function to create the table
      const { error: createError } = await supabaseAdmin.rpc('create_dynamic_table', {
        table_name: name,
        table_label: label
      });

      if (createError) {
        console.error("Error creating table:", createError);
        // Don't fail the request - metadata is created, table can be created manually
        console.warn("Table metadata created, but actual table creation failed. You may need to run the create_dynamic_table function in Supabase.");
      } else {
        console.log(`Successfully created table: ${name}`);
      }
    } catch (createError: any) {
      console.warn("Table creation skipped (database function may not exist):", createError.message);
      console.warn("Please run supabase-create-table-function.sql in Supabase SQL Editor to enable automatic table creation.");
    }

    return NextResponse.json(tableMeta, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/tables:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

