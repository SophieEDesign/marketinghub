import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api";
import { fetchPlanablePosts, getPlanableConfig } from "@/lib/planable/client";

export const dynamic = "force-dynamic";

const MEMBER_STATUSES = new Set(["Scheduled", "Published"]);

export async function GET() {
  const { user, error } = await requireStaff();
  if (error) return error;
  const config = getPlanableConfig();
  const result = await fetchPlanablePosts();
  if (user.role !== "admin") {
    return NextResponse.json({
      ...result,
      posts: (result.posts ?? []).filter((p) => MEMBER_STATUSES.has(p.status)),
      workspaceId: config.workspaceId,
    });
  }
  return NextResponse.json({ ...result, workspaceId: config.workspaceId });
}
