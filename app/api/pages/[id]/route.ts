import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: page, error: pageError } = await supabase
      .from("pages")
      .select("*")
      .eq("id", params.id)
      .single();

    if (pageError) {
      console.error("Error fetching page:", pageError);
      return NextResponse.json({ error: pageError.message }, { status: 500 });
    }

    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    // Blocks are now stored in page.blocks JSONB field
    // For backward compatibility, also check page_blocks table if blocks field is empty
    let pageBlocks = page.blocks || [];
    
    if (!pageBlocks || (Array.isArray(pageBlocks) && pageBlocks.length === 0)) {
      // Fallback to old page_blocks table for backward compatibility
      const { data: oldBlocks, error: blocksError } = await supabase
        .from("page_blocks")
        .select("*")
        .eq("page_id", params.id)
        .order("position_y", { ascending: true })
        .order("position_x", { ascending: true });

      if (!blocksError && oldBlocks && oldBlocks.length > 0) {
        // Convert old format to new format
        pageBlocks = oldBlocks.map((block: any) => ({
          id: block.id,
          type: block.type,
          position: {
            x: block.position_x || 0,
            y: block.position_y || 0,
            w: block.width || 6,
            h: block.height || 3,
          },
          settings: block.config || {},
        }));
      }
    }

    return NextResponse.json({
      ...page,
      blocks: pageBlocks,
    });
  } catch (error: any) {
    console.error("Error in GET /api/pages/[id]:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, description, icon, layout, page_type, settings, actions, quick_automations, blocks } = body;

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (layout !== undefined) updateData.layout = layout;
    if (page_type !== undefined) updateData.page_type = page_type;
    if (settings !== undefined) updateData.settings = settings;
    if (actions !== undefined) updateData.actions = actions;
    if (quick_automations !== undefined) updateData.quick_automations = quick_automations;
    if (blocks !== undefined) updateData.blocks = blocks; // Store blocks in JSONB field

    const { data, error } = await supabase
      .from("pages")
      .update(updateData)
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating page:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error in PUT /api/pages/[id]:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Blocks will be deleted automatically due to CASCADE
    const { error } = await supabase
      .from("pages")
      .delete()
      .eq("id", params.id);

    if (error) {
      console.error("Error deleting page:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in DELETE /api/pages/[id]:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

