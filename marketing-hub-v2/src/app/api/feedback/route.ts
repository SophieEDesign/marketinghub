import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";

async function getFeedbackItem(supabase: ReturnType<typeof createServiceClient>, id: string) {
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  let query = supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false });

  if (user.role !== "admin") {
    query = query.eq("submitted_by", user.id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const supabase = createServiceClient();

  if (body.action === "update" && body.id) {
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { error } = await supabase
      .from("feedback")
      .update(body.patch)
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "delete" && body.id) {
    const existing = await getFeedbackItem(supabase, body.id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const isOwner = existing.submitted_by === user.id;
    if (user.role !== "admin" && !isOwner) {
      return NextResponse.json(
        { error: "You can only delete feedback you submitted" },
        { status: 403 }
      );
    }
    const { error } = await supabase.from("feedback").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase.from("feedback").insert({
    type: body.type,
    title: body.title,
    description: body.description ?? null,
    priority: body.priority ?? "medium",
    submitted_by: user.id,
    submitted_by_name: user.full_name ?? body.submitted_by_name ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
