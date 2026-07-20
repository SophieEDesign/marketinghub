import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireAdmin, requireStaff } from "@/lib/api";
import { readStore, updateStore } from "@/lib/store/local";
import {
  isMonthlyPlanMatrix,
  PAGE_NOTE_KEYS,
  parseMonthlyPlan,
  serializeMonthlyPlan,
  SOCIAL_MONTHLY_PLAN_KEY,
  type PageNoteKey,
} from "@/lib/social/monthly-plan";
import type { HubPageNotes } from "@/lib/types";

function isPageNoteKey(value: unknown): value is PageNoteKey {
  return (
    typeof value === "string" &&
    (PAGE_NOTE_KEYS as string[]).includes(value)
  );
}

function resolveBody(notes: HubPageNotes | undefined, key: PageNoteKey): string {
  const stored = notes?.[key];
  if (key === SOCIAL_MONTHLY_PLAN_KEY) {
    return serializeMonthlyPlan(parseMonthlyPlan(stored));
  }
  if (typeof stored === "string" && stored.trim()) return stored;
  return "";
}

export async function GET(request: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;

  const keyParam = request.nextUrl.searchParams.get("key");
  if (!isPageNoteKey(keyParam)) {
    return jsonError("Invalid or missing key", 400);
  }

  const store = await readStore();
  const body = resolveBody(store.page_notes, keyParam);
  if (keyParam === SOCIAL_MONTHLY_PLAN_KEY) {
    return jsonOk({
      key: keyParam,
      body,
      plan: parseMonthlyPlan(body),
    });
  }
  return jsonOk({ key: keyParam, body });
}

export async function PUT(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const payload = await request.json();
  const key = payload.key;
  if (!isPageNoteKey(key)) {
    return jsonError("Invalid or missing key", 400);
  }

  let body: string;
  if (key === SOCIAL_MONTHLY_PLAN_KEY) {
    const plan =
      payload.plan && isMonthlyPlanMatrix(payload.plan)
        ? payload.plan
        : typeof payload.body === "string"
          ? parseMonthlyPlan(payload.body)
          : null;
    if (!plan) {
      return jsonError("Invalid monthly plan matrix", 400);
    }
    // Sanitize cell strings (plain text only).
    body = serializeMonthlyPlan({
      version: 1,
      rows: plan.rows.map((row) => ({
        day: String(row.day).slice(0, 40),
        theme: String(row.theme).slice(0, 120),
        weeks: row.weeks.map((cell) => String(cell).slice(0, 400)) as [
          string,
          string,
          string,
          string,
        ],
      })),
    });
  } else if (typeof payload.body === "string") {
    body = payload.body;
  } else {
    return jsonError("body must be a string", 400);
  }

  const store = await updateStore((current) => {
    current.page_notes = {
      ...(current.page_notes ?? {}),
      [key]: body,
    };
  });

  const nextBody = resolveBody(store.page_notes, key);
  if (key === SOCIAL_MONTHLY_PLAN_KEY) {
    return jsonOk({
      key,
      body: nextBody,
      plan: parseMonthlyPlan(nextBody),
    });
  }
  return jsonOk({ key, body: nextBody });
}
