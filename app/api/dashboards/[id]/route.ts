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
      .maybeSingle();

    if (dashboardError) {
      console.error("[API] Error fetching dashboard:", JSON.stringify(dashboardError, null, 2));
      
      // Check if table doesn't exist (various error formats)
      const errorMessage = dashboardError.message || '';
      const errorCode = dashboardError.code || '';
      const isTableMissing = 
        errorCode === 'PGRST116' || 
        errorCode === '42P01' ||
        errorMessage.toLowerCase().includes('relation') || 
        errorMessage.toLowerCase().includes('does not exist') ||
        errorMessage.toLowerCase().includes('table') && errorMessage.toLowerCase().includes('not found');
      
      if (isTableMissing) {
        console.error("[API] Dashboard table missing - migration required");
        return NextResponse.json({ 
          error: "Dashboard tables not found. Please run the migration: supabase-dashboard-complete-migration.sql",
          details: errorMessage,
          code: errorCode
        }, { status: 500 });
      }
      
      return NextResponse.json({ 
        error: dashboardError.message || "Failed to fetch dashboard",
        code: errorCode,
        details: JSON.stringify(dashboardError)
      }, { status: 500 });
    }

    // If dashboard doesn't exist, create default one
    if (!dashboard && id === "00000000-0000-0000-0000-000000000001") {
      const { data: newDashboard, error: createError } = await supabaseAdmin
        .from("dashboards")
        .insert([{ id: id, name: "Main Dashboard" }])
        .select()
        .single();
      
      if (createError) {
        console.error("[API] Error creating default dashboard:", createError);
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }
      
      return NextResponse.json({
        dashboard: newDashboard,
        modules: [],
      });
    }

    if (!dashboard) {
      return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });
    }

    // Get modules
    const { data: modules, error: modulesError } = await supabaseAdmin
      .from("dashboard_modules")
      .select("*")
      .eq("dashboard_id", id)
      .order("position_y", { ascending: true })
      .order("position_x", { ascending: true });

    if (modulesError) {
      console.error("[API] Error fetching modules:", JSON.stringify(modulesError, null, 2));
      
      // Check if table doesn't exist
      const errorMessage = modulesError.message || '';
      const errorCode = modulesError.code || '';
      const isTableMissing = 
        errorCode === 'PGRST116' || 
        errorCode === '42P01' ||
        errorMessage.toLowerCase().includes('relation') || 
        errorMessage.toLowerCase().includes('does not exist') ||
        errorMessage.toLowerCase().includes('table') && errorMessage.toLowerCase().includes('not found');
      
      // If table doesn't exist, return empty array instead of error
      if (isTableMissing) {
        console.warn("[API] Dashboard modules table missing - returning empty array");
        return NextResponse.json({
          dashboard,
          modules: [],
        });
      }
      
      return NextResponse.json({ 
        error: modulesError.message || "Failed to fetch modules",
        code: errorCode
      }, { status: 500 });
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

