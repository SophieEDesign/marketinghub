import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/dashboards/[id] - Get a dashboard with modules
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Get dashboard
    const { data: dashboard, error: dashboardError } = await supabaseAdmin
      .from("dashboards")
      .select("*")
      .eq("id", id)
      .single();

    if (dashboardError) {
      console.error("[API] Error fetching dashboard:", dashboardError);
      return NextResponse.json({ error: dashboardError.message }, { status: 500 });
    }

    // Get modules
    const { data: modules, error: modulesError } = await supabaseAdmin
      .from("dashboard_modules")
      .select("*")
      .eq("dashboard_id", id)
      .order("position_y", { ascending: true })
      .order("position_x", { ascending: true });

    if (modulesError) {
      console.error("[API] Error fetching modules:", modulesError);
      return NextResponse.json({ error: modulesError.message }, { status: 500 });
    }

    return NextResponse.json({
      dashboard,
      modules: modules || [],
    });
  } catch (error: any) {
    console.error("[API] Exception in GET /api/dashboards/[id]:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/dashboards/[id] - Update dashboard
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { name } = body;

    const { data, error } = await supabaseAdmin
      .from("dashboards")
      .update({ name })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[API] Error updating dashboard:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ dashboard: data });
  } catch (error: any) {
    console.error("[API] Exception in PUT /api/dashboards/[id]:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/dashboards/[id] - Delete dashboard
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { error } = await supabaseAdmin
      .from("dashboards")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[API] Error deleting dashboard:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API] Exception in DELETE /api/dashboards/[id]:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

