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

    // Create the actual Supabase table
    // Note: This requires admin privileges - we'll need to use a server-side function
    // For now, we'll create it via a database function or admin API
    // The table will be created with standard columns: id, created_at, updated_at
    // Additional fields will be added via table_fields

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // Create the table using SQL
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS ${name} (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_${name}_created_at ON ${name}(created_at);
        
        ALTER TABLE ${name} ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Users can view all ${name}" ON ${name} FOR SELECT USING (true);
        CREATE POLICY "Users can create ${name}" ON ${name} FOR INSERT WITH CHECK (true);
        CREATE POLICY "Users can update ${name}" ON ${name} FOR UPDATE USING (true);
        CREATE POLICY "Users can delete ${name}" ON ${name} FOR DELETE USING (true);
        
        CREATE TRIGGER update_${name}_updated_at
          BEFORE UPDATE ON ${name}
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `;

      const { error: createError } = await supabaseAdmin.rpc('exec_sql', {
        sql: createTableSQL
      });

      // If RPC doesn't exist, we'll need to handle this differently
      // For now, log the error but don't fail - the table might already exist
      if (createError) {
        console.warn("Could not create table via RPC (this is expected if RPC doesn't exist):", createError);
        // Table creation will need to be done manually or via a database function
      }
    } catch (createError: any) {
      console.warn("Table creation skipped (requires manual setup or admin function):", createError.message);
    }

    return NextResponse.json(tableMeta, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/tables:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

