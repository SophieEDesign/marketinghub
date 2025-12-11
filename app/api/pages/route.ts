import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
      const { data, error } = await supabase
        .from("pages")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching pages:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("Error in GET /api/pages:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, icon, layout, page_type } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Use page_type if provided, otherwise fall back to layout mapping or 'custom'
    const finalPageType = page_type || (layout === 'custom' ? 'custom' : layout) || 'custom';

      const { data, error } = await supabase
        .from("pages")
        .insert({
          name,
          layout: layout || "custom",
          page_type: finalPageType,
        })
      .select()
      .single();

    if (error) {
      console.error("Error creating page:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/pages:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

