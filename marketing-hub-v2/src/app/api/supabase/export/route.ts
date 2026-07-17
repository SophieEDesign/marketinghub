import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api";
import { hasSupabaseConfig } from "@/lib/auth/config";
import { hasServiceRoleKey } from "@/lib/supabase/admin";
import { exportStoreToSupabase } from "@/lib/supabase/export-hub";

export const dynamic = "force-dynamic";

/** Push local hub store → durable Supabase hub tables. */
export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;

  if (!hasSupabaseConfig() || !hasServiceRoleKey()) {
    return NextResponse.json(
      {
        error:
          "Supabase service role required. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 503 }
    );
  }

  try {
    const counts = await exportStoreToSupabase();
    return NextResponse.json({ ok: true, counts });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Export failed" },
      { status: 500 }
    );
  }
}
