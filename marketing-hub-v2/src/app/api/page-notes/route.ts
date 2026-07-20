import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireAdmin, requireStaff } from "@/lib/api";
import { readStore, updateStore } from "@/lib/store/local";
import { normalizeRichTextStorage } from "@/lib/sanitize";
import {
  DEFAULT_SOCIAL_MONTHLY_PLAN_HTML,
  PAGE_NOTE_KEYS,
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

function defaultBodyForKey(key: PageNoteKey): string {
  if (key === SOCIAL_MONTHLY_PLAN_KEY) {
    return DEFAULT_SOCIAL_MONTHLY_PLAN_HTML;
  }
  return "";
}

function resolveBody(notes: HubPageNotes | undefined, key: PageNoteKey): string {
  const stored = notes?.[key];
  if (typeof stored === "string" && stored.trim()) return stored;
  return defaultBodyForKey(key);
}

export async function GET(request: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;

  const keyParam = request.nextUrl.searchParams.get("key");
  if (!isPageNoteKey(keyParam)) {
    return jsonError("Invalid or missing key", 400);
  }

  const store = await readStore();
  return jsonOk({
    key: keyParam,
    body: resolveBody(store.page_notes, keyParam),
  });
}

export async function PUT(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const payload = await request.json();
  const key = payload.key;
  if (!isPageNoteKey(key)) {
    return jsonError("Invalid or missing key", 400);
  }
  if (typeof payload.body !== "string") {
    return jsonError("body must be a string", 400);
  }

  const body = normalizeRichTextStorage(payload.body);

  const store = await updateStore((current) => {
    current.page_notes = {
      ...(current.page_notes ?? {}),
      [key]: body,
    };
  });

  return jsonOk({
    key,
    body: resolveBody(store.page_notes, key),
  });
}
