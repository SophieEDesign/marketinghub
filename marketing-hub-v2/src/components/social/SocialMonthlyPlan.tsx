"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Pencil } from "lucide-react";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { RichTextView } from "@/components/ui/RichTextView";
import { useHubView } from "@/lib/hub-view";
import {
  DEFAULT_SOCIAL_MONTHLY_PLAN_HTML,
  SOCIAL_MONTHLY_PLAN_KEY,
} from "@/lib/social/monthly-plan";
import { cn } from "@/lib/utils";

export function SocialMonthlyPlan() {
  const { view } = useHubView();
  const canEdit = view === "admin";

  const [open, setOpen] = useState(true);
  const [body, setBody] = useState(DEFAULT_SOCIAL_MONTHLY_PLAN_HTML);
  const [draft, setDraft] = useState(DEFAULT_SOCIAL_MONTHLY_PLAN_HTML);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/page-notes?key=${encodeURIComponent(SOCIAL_MONTHLY_PLAN_KEY)}`
        );
        if (!res.ok) throw new Error("Failed to load plan");
        const data = (await res.json()) as { body?: string };
        if (cancelled) return;
        const next =
          typeof data.body === "string" && data.body.trim()
            ? data.body
            : DEFAULT_SOCIAL_MONTHLY_PLAN_HTML;
        setBody(next);
        setDraft(next);
      } catch {
        if (!cancelled) {
          setBody(DEFAULT_SOCIAL_MONTHLY_PLAN_HTML);
          setDraft(DEFAULT_SOCIAL_MONTHLY_PLAN_HTML);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const startEdit = useCallback(() => {
    setDraft(body);
    setError(null);
    setEditing(true);
    setOpen(true);
  }, [body]);

  const cancelEdit = useCallback(() => {
    setDraft(body);
    setError(null);
    setEditing(false);
  }, [body]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/page-notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: SOCIAL_MONTHLY_PLAN_KEY,
          body: draft,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || "Failed to save");
      }
      const data = (await res.json()) as { body?: string };
      const next =
        typeof data.body === "string" ? data.body : draft;
      setBody(next);
      setDraft(next);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [draft]);

  return (
    <div className="surface-card mb-5 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted transition-transform",
              !open && "-rotate-90"
            )}
          />
          <span className="font-display text-sm text-brand">
            Monthly posting plan
          </span>
          <span className="text-xs text-muted">Reference</span>
        </button>
        {canEdit && !editing ? (
          <button
            type="button"
            className="btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs"
            onClick={startEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="px-4 py-3">
          {loading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : editing ? (
            <div className="space-y-3">
              <RichTextEditor
                value={draft}
                onChange={setDraft}
                placeholder="Weekday cadence, spotlights, feature rotation…"
                minHeight="140px"
                compact
              />
              {error ? (
                <p className="text-sm text-red-600">{error}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={save}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={cancelEdit}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <RichTextView
              html={body}
              className="[&_li]:my-0.5 [&_p]:my-1 [&_ul]:my-1"
              empty="No monthly plan yet."
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
