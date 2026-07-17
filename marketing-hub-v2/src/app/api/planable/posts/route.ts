import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api";
import { fetchPlanablePosts, getPlanableConfig } from "@/lib/planable/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;
  const config = getPlanableConfig();
  const result = await fetchPlanablePosts();
  return NextResponse.json({ ...result, workspaceId: config.workspaceId });
}
