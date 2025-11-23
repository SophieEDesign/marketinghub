import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { page_id, type, position_x, position_y, width, height, config } = body;

    if (!page_id || !type) {
      return NextResponse.json({ error: "page_id and type are required" }, { status: 400 });
    }

      const { data, error } = await supabase
        .from("page_blocks")
        .insert({
        page_id,
        type,
        position_x: position_x || 0,
        position_y: position_y || 0,
        width: width || 12,
        height: height || 6,
        config: config || {},
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating block:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/page-blocks:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

