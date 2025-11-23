import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/dashboards - List all dashboards
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from("dashboards")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[API] Error fetching dashboards:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ dashboards: data || [] });
  } catch (error: any) {
    console.error("[API] Exception in GET /api/dashboards:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/dashboards - Create a new dashboard
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("dashboards")
      .insert([{ name }])
      .select()
      .single();

    if (error) {
      console.error("[API] Error creating dashboard:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ dashboard: data });
  } catch (error: any) {
    console.error("[API] Exception in POST /api/dashboards:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

