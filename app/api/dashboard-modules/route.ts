import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST /api/dashboard-modules - Create a new module
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dashboard_id, type, position_x, position_y, width, height, config } = body;

    if (!dashboard_id || !type) {
      return NextResponse.json(
        { error: "dashboard_id and type are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("dashboard_modules")
      .insert([
        {
          dashboard_id,
          type,
          position_x: position_x || 0,
          position_y: position_y || 0,
          width: width || 4,
          height: height || 4,
          config: config || {},
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("[API] Error creating module:", JSON.stringify(error, null, 2));
      
      // Check if table doesn't exist
      const errorMessage = error.message || '';
      const errorCode = error.code || '';
      const isTableMissing = 
        errorCode === 'PGRST116' || 
        errorCode === '42P01' ||
        errorMessage.toLowerCase().includes('relation') || 
        errorMessage.toLowerCase().includes('does not exist') ||
        errorMessage.toLowerCase().includes('table') && errorMessage.toLowerCase().includes('not found');
      
      if (isTableMissing) {
        console.error("[API] Dashboard modules table missing - migration required");
        return NextResponse.json({ 
          error: "Dashboard tables not found. Please run the migration: supabase-dashboard-complete-migration.sql",
          details: errorMessage,
          code: errorCode
        }, { status: 500 });
      }
      
      return NextResponse.json({ 
        error: error.message || "Failed to create module",
        code: errorCode,
        details: JSON.stringify(error)
      }, { status: 500 });
    }

    return NextResponse.json({ module: data });
  } catch (error: any) {
    console.error("[API] Exception in POST /api/dashboard-modules:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

