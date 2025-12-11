import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateAutomation } from "@/lib/automations/validateAutomation";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = 'force-dynamic';

export interface Automation {
  id?: string;
  name: string;
  status: "active" | "paused";
  trigger: any;
  conditions?: any[];
  actions: any[];
  created_at?: string;
  updated_at?: string;
}

/**
 * GET /api/automations
 * List all automations
 */
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from("automations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[API] Error fetching automations:", error);
      return NextResponse.json(
        { error: "Failed to fetch automations", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ automations: data || [] });
  } catch (error: any) {
    console.error("[API] Exception in GET /api/automations:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/automations
 * Create a new automation
 */
export async function POST(request: NextRequest) {
  try {
    const body: Automation = await request.json();

    const automationData = {
      name: body.name,
      status: body.status || "active",
      trigger: body.trigger,
      conditions: body.conditions || [],
      actions: body.actions,
    };

    // Validate automation
    const validation = validateAutomation(automationData);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Validation failed",
          errors: validation.errors,
          warnings: validation.warnings,
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("automations")
      .insert(automationData)
      .select()
      .single();

    if (error) {
      console.error("[API] Error creating automation:", error);
      return NextResponse.json(
        { error: "Failed to create automation", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ automation: data }, { status: 201 });
  } catch (error: any) {
    console.error("[API] Exception in POST /api/automations:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

