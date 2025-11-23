import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { position_x, position_y, width, height, config } = body;

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (position_x !== undefined) updateData.position_x = position_x;
    if (position_y !== undefined) updateData.position_y = position_y;
    if (width !== undefined) updateData.width = width;
    if (height !== undefined) updateData.height = height;
    if (config !== undefined) updateData.config = config;

      const { data, error } = await supabase
        .from("page_blocks")
        .update(updateData)
        .eq("id", params.id)
        .select()
        .single();

    if (error) {
      console.error("Error updating block:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error in PUT /api/page-blocks/[id]:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
      const { error } = await supabase
        .from("page_blocks")
        .delete()
        .eq("id", params.id);

    if (error) {
      console.error("Error deleting block:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in DELETE /api/page-blocks/[id]:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

