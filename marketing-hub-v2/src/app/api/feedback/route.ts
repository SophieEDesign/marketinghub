import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  const body = await req.json();
  const supabase = createServiceClient();

  if (body.action === "update" && body.id) {
    const { error } = await supabase
      .from("feedback")
      .update(body.patch)
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "delete" && body.id) {
    const { error } = await supabase.from("feedback").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase.from("feedback").insert({
    type: body.type,
    title: body.title,
    description: body.description ?? null,
    priority: body.priority ?? "medium",
    submitted_by: user?.id ?? null,
    submitted_by_name: user?.full_name ?? body.submitted_by_name ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
