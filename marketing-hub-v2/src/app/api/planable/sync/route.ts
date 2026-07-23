import { NextResponse } from "next/server";
import { requireAdmin, requireStaff } from "@/lib/api";
import { getPlanableConfig } from "@/lib/planable/client";
import { syncPlanableIntoHub } from "@/lib/planable/sync";

export const dynamic = "force-dynamic";

/** Sync status / config (staff). */
export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;
  const config = getPlanableConfig();
  return NextResponse.json({
    configured: config.configured,
    workspaceId: config.workspaceId ?? null,
    openUrl: config.openUrl,
  });
}

/** Pull Planable posts into Hub social content (admin). */
export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;
  const result = await syncPlanableIntoHub();
  return NextResponse.json(result, {
    status: result.configured ? 200 : 400,
  });
}
