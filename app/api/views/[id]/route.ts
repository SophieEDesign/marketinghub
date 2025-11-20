import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use service role for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface ViewConfig {
  id?: string;
  table_name?: string;
  view_name?: string;
  view_type?: string;
  column_order?: string[];
  column_widths?: Record<string, number>;
  hidden_columns?: string[];
  filters?: any[];
  sort?: any[];
  groupings?: Array<{ name: string; fields: string[] }>;
  row_height?: string;
  is_default?: boolean;
}

// PUT /api/views/[id] - Update a view
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body: Partial<ViewConfig> = await request.json();
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "View ID is required" },
        { status: 400 }
      );
    }

    // If setting as default, unset other defaults for this table
    if (body.is_default === true) {
      // First get the table_name from the view
      const { data: existingView } = await supabaseAdmin
        .from("table_view_configs")
        .select("table_name")
        .eq("id", id)
        .single();

      if (existingView) {
        await supabaseAdmin
          .from("table_view_configs")
          .update({ is_default: false })
          .eq("table_name", existingView.table_name)
          .eq("is_default", true)
          .neq("id", id);
      }
    }

    const updateData: any = {};
    if (body.view_name !== undefined) updateData.view_name = body.view_name;
    if (body.view_type !== undefined) updateData.view_type = body.view_type;
    if (body.column_order !== undefined) updateData.column_order = body.column_order;
    if (body.column_widths !== undefined) updateData.column_widths = body.column_widths;
    if (body.hidden_columns !== undefined) updateData.hidden_columns = body.hidden_columns;
    if (body.filters !== undefined) updateData.filters = body.filters;
    if (body.sort !== undefined) updateData.sort = body.sort;
    if (body.groupings !== undefined) updateData.groupings = body.groupings;
    if (body.row_height !== undefined) updateData.row_height = body.row_height;
    if (body.is_default !== undefined) updateData.is_default = body.is_default;

    const { data, error } = await supabaseAdmin
      .from("table_view_configs")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[API] Error updating view:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ view: data });
  } catch (error: any) {
    console.error("[API] Exception in PUT /api/views/[id]:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/views/[id] - Delete a view
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "View ID is required" },
        { status: 400 }
      );
    }

    // Get the view to check if it's default and get table_name
    const { data: view } = await supabaseAdmin
      .from("table_view_configs")
      .select("table_name, is_default")
      .eq("id", id)
      .single();

    if (!view) {
      return NextResponse.json(
        { error: "View not found" },
        { status: 404 }
      );
    }

    // Delete the view
    const { error: deleteError } = await supabaseAdmin
      .from("table_view_configs")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("[API] Error deleting view:", deleteError);
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    // If it was the default, set another view as default (or create a default view)
    if (view.is_default) {
      const { data: otherViews } = await supabaseAdmin
        .from("table_view_configs")
        .select("id")
        .eq("table_name", view.table_name)
        .limit(1)
        .single();

      if (otherViews) {
        // Set the first other view as default
        await supabaseAdmin
          .from("table_view_configs")
          .update({ is_default: true })
          .eq("id", otherViews.id);
      } else {
        // Create a default view if none exist
        await supabaseAdmin
          .from("table_view_configs")
          .insert([
            {
              table_name: view.table_name,
              view_name: "Default View",
              view_type: "grid",
              is_default: true,
            },
          ]);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API] Exception in DELETE /api/views/[id]:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

