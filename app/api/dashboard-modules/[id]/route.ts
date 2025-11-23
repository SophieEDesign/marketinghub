import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// PUT /api/dashboard-modules/[id] - Update module
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { position_x, position_y, width, height, config } = body;

    const updateData: any = {};
    if (position_x !== undefined) updateData.position_x = position_x;
    if (position_y !== undefined) updateData.position_y = position_y;
    if (width !== undefined) updateData.width = width;
    if (height !== undefined) updateData.height = height;
    if (config !== undefined) updateData.config = config;

    const { data, error } = await supabaseAdmin
      .from("dashboard_modules")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[API] Error updating module:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ module: data });
  } catch (error: any) {
    console.error("[API] Exception in PUT /api/dashboard-modules/[id]:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/dashboard-modules/[id] - Delete module
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { error } = await supabaseAdmin
      .from("dashboard_modules")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[API] Error deleting module:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API] Exception in DELETE /api/dashboard-modules/[id]:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

