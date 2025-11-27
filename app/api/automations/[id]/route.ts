import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = 'force-dynamic';

/**
 * GET /api/automations/[id]
 * Get a single automation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { data, error } = await supabaseAdmin
      .from("automations")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("[API] Error fetching automation:", error);
      return NextResponse.json(
        { error: "Failed to fetch automation", details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Automation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ automation: data });
  } catch (error: any) {
    console.error("[API] Exception in GET /api/automations/[id]:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/automations/[id]
 * Update an automation
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.trigger !== undefined) updateData.trigger = body.trigger;
    if (body.conditions !== undefined) updateData.conditions = body.conditions;
    if (body.actions !== undefined) updateData.actions = body.actions;

    const { data, error } = await supabaseAdmin
      .from("automations")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[API] Error updating automation:", error);
      return NextResponse.json(
        { error: "Failed to update automation", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ automation: data });
  } catch (error: any) {
    console.error("[API] Exception in PUT /api/automations/[id]:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/automations/[id]
 * Delete an automation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { error } = await supabaseAdmin
      .from("automations")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[API] Error deleting automation:", error);
      return NextResponse.json(
        { error: "Failed to delete automation", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API] Exception in DELETE /api/automations/[id]:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

