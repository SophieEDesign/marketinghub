import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireStaff } from "@/lib/api";
import {
  createPaidCampaign,
  deletePaidCampaign,
  listPaidCampaigns,
  updatePaidCampaign,
} from "@/lib/data/repos";
import type { PaidCampaign, PaidCampaignStatus } from "@/lib/types";

function parseStatus(value: unknown): PaidCampaignStatus {
  const s = String(value ?? "draft");
  if (s === "active" || s === "paused" || s === "complete") return s;
  return "draft";
}

function parseNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseNullableId(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s || null;
}

function patchFromBody(
  patch: Record<string, unknown>
): Partial<PaidCampaign> {
  const out: Partial<PaidCampaign> = {};
  if (patch.name !== undefined) {
    out.name = String(patch.name).trim() || "Untitled campaign";
  }
  if (patch.platform !== undefined) {
    out.platform = String(patch.platform).trim() || "LinkedIn";
  }
  if (patch.status !== undefined) out.status = parseStatus(patch.status);
  if (patch.external_id !== undefined) {
    out.external_id = String(patch.external_id).trim();
  }
  if (patch.external_url !== undefined) {
    out.external_url = String(patch.external_url).trim();
  }
  if (patch.starts_at !== undefined) {
    out.starts_at = patch.starts_at ? String(patch.starts_at) : null;
  }
  if (patch.ends_at !== undefined) {
    out.ends_at = patch.ends_at ? String(patch.ends_at) : null;
  }
  if (patch.spent !== undefined) out.spent = parseNumber(patch.spent);
  if (patch.goal !== undefined) out.goal = String(patch.goal).trim();
  if (patch.key_results !== undefined) {
    out.key_results = String(patch.key_results).trim();
  }
  if (patch.cost_per_result !== undefined) {
    out.cost_per_result = parseNumber(patch.cost_per_result);
  }
  if (patch.impressions !== undefined) {
    out.impressions = parseNumber(patch.impressions);
  }
  if (patch.clicks !== undefined) out.clicks = parseNumber(patch.clicks);
  if (patch.ctr !== undefined) out.ctr = String(patch.ctr).trim();
  if (patch.landing_clicks !== undefined) {
    out.landing_clicks = parseNumber(patch.landing_clicks);
  }
  if (patch.engagement_rate !== undefined) {
    out.engagement_rate = String(patch.engagement_rate).trim();
  }
  if (patch.notes !== undefined) out.notes = String(patch.notes).trim();
  if (patch.theme_id !== undefined) {
    out.theme_id = parseNullableId(patch.theme_id);
  }
  if (patch.content_id !== undefined) {
    out.content_id = parseNullableId(patch.content_id);
  }
  if (patch.event_id !== undefined) {
    out.event_id = parseNullableId(patch.event_id);
  }
  return out;
}

function bodyToInput(body: Record<string, unknown>) {
  return {
    name: String(body.name ?? "").trim() || "Untitled campaign",
    platform: String(body.platform ?? "LinkedIn").trim() || "LinkedIn",
    status: parseStatus(body.status),
    external_id: String(body.external_id ?? "").trim(),
    external_url: String(body.external_url ?? "").trim(),
    starts_at: body.starts_at ? String(body.starts_at) : null,
    ends_at: body.ends_at ? String(body.ends_at) : null,
    spent: parseNumber(body.spent),
    goal: String(body.goal ?? "").trim(),
    key_results: String(body.key_results ?? "").trim(),
    cost_per_result: parseNumber(body.cost_per_result),
    impressions: parseNumber(body.impressions),
    clicks: parseNumber(body.clicks),
    ctr: String(body.ctr ?? "").trim(),
    landing_clicks: parseNumber(body.landing_clicks),
    engagement_rate: String(body.engagement_rate ?? "").trim(),
    notes: String(body.notes ?? "").trim(),
    theme_id: parseNullableId(body.theme_id),
    content_id: parseNullableId(body.content_id),
    event_id: parseNullableId(body.event_id),
  } satisfies Omit<PaidCampaign, "id" | "created_at" | "updated_at">;
}

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;
  return jsonOk({ paid_campaigns: await listPaidCampaigns() });
}

export async function POST(request: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;
  const body = (await request.json()) as Record<string, unknown>;
  const action = body.action as string | undefined;

  if (action === "update") {
    const patch = body.patch as Record<string, unknown> | undefined;
    if (!patch) return jsonError("Missing patch", 400);
    const updated = await updatePaidCampaign(
      String(body.id),
      patchFromBody(patch)
    );
    if (!updated) return jsonError("Not found", 404);
    return jsonOk({ item: updated });
  }

  if (action === "delete") {
    await deletePaidCampaign(String(body.id));
    return jsonOk({ ok: true });
  }

  const item = await createPaidCampaign(bodyToInput(body));
  return jsonOk({ item }, { status: 201 });
}
