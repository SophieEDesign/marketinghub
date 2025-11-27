import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = 'force-dynamic';

/**
 * GET /api/automations/[id]/logs
 * Get logs for a specific automation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "100");

    const { data, error } = await supabaseAdmin
      .from("automation_logs")
      .select("*")
      .eq("automation_id", id)
      .order("timestamp", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[API] Error fetching automation logs:", error);
      return NextResponse.json(
        { error: "Failed to fetch logs", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ logs: data || [] });
  } catch (error: any) {
    console.error("[API] Exception in GET /api/automations/[id]/logs:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

