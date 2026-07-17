import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getTable } from "@/lib/crud/tables"

/**
 * PATCH /api/tables/[tableId]/records/[recordId]/comments/[commentId]
 * Update own comment.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string; recordId: string; commentId: string }> }
) {
  try {
    const { tableId, recordId, commentId } = await params
    const table = await getTable(tableId)
    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 })
    }

    const body = await request.json()
    const text = typeof body.body === "string" ? body.body.trim() : ""
    if (!text) {
      return NextResponse.json(
        { error: "Comment body is required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: comment, error } = await supabase
      .from("record_comments")
      .update({ body: text })
      .eq("id", commentId)
      .eq("table_id", tableId)
      .eq("record_id", recordId)
      .eq("user_id", user.id)
      .select("id, user_id, body, created_at, updated_at")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!comment) {
      return NextResponse.json(
        { error: "Comment not found or not authorized to update" },
        { status: 404 }
      )
    }

    return NextResponse.json({ comment })
  } catch (error: unknown) {
    console.error("Error in comment PATCH:", error)
    const msg = (error as { message?: string })?.message || "Failed to update comment"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * DELETE /api/tables/[tableId]/records/[recordId]/comments/[commentId]
 * Delete own comment.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string; recordId: string; commentId: string }> }
) {
  try {
    const { tableId, recordId, commentId } = await params
    const table = await getTable(tableId)
    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { error } = await supabase
      .from("record_comments")
      .delete()
      .eq("id", commentId)
      .eq("table_id", tableId)
      .eq("record_id", recordId)
      .eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("Error in comment DELETE:", error)
    const msg = (error as { message?: string })?.message || "Failed to delete comment"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
