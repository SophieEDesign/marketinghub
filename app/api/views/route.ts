import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use service role for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface ViewConfig {
  id?: string;
  table_name: string;
  view_name: string;
  view_type: string;
  column_order?: string[];
  column_widths?: Record<string, number>;
  hidden_columns?: string[];
  filters?: any[];
  sort?: any[];
  groupings?: Array<{ name: string; fields: string[] }>;
  row_height?: string;
  is_default?: boolean;
}

// GET /api/views?table=content
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tableName = searchParams.get("table");

    if (!tableName) {
      return NextResponse.json(
        { error: "table parameter is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("table_view_configs")
      .select("*")
      .eq("table_name", tableName)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[API] Error fetching views:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ views: data || [] });
  } catch (error: any) {
    console.error("[API] Exception in GET /api/views:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/views - Create a new view
export async function POST(request: NextRequest) {
  try {
    const body: ViewConfig = await request.json();

    if (!body.table_name || !body.view_name || !body.view_type) {
      return NextResponse.json(
        { error: "table_name, view_name, and view_type are required" },
        { status: 400 }
      );
    }

    // If this is set as default, unset other defaults for this table
    if (body.is_default) {
      await supabaseAdmin
        .from("table_view_configs")
        .update({ is_default: false })
        .eq("table_name", body.table_name)
        .eq("is_default", true);
    }

    const { data, error } = await supabaseAdmin
      .from("table_view_configs")
      .insert([
        {
          table_name: body.table_name,
          view_name: body.view_name,
          view_type: body.view_type,
          column_order: body.column_order || [],
          column_widths: body.column_widths || {},
          hidden_columns: body.hidden_columns || [],
          filters: body.filters || [],
          sort: body.sort || [],
          groupings: body.groupings || [],
          row_height: body.row_height || "medium",
          is_default: body.is_default || false,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("[API] Error creating view:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ view: data });
  } catch (error: any) {
    console.error("[API] Exception in POST /api/views:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

