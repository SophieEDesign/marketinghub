import { NextRequest, NextResponse } from "next/server";
import { deleteRecord, deleteAsset, parseStorageUrl } from "@/lib/deleteRecord";

// DELETE /api/tables/[table]/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { table: string; id: string } }
) {
  try {
    const { table, id } = params;

    if (!table || !id) {
      return NextResponse.json(
        { error: "Table and ID are required" },
        { status: 400 }
      );
    }

    // Special handling for assets (delete file too)
    if (table === "assets") {
      // Get the asset record first to get file_url
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data: asset } = await supabaseAdmin
        .from("assets")
        .select("file_url")
        .eq("id", id)
        .single();

      const result = await deleteAsset(id, asset?.file_url);
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    // Regular deletion for other tables
    const result = await deleteRecord(table, id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API] Exception in DELETE /api/tables/[table]/[id]:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

