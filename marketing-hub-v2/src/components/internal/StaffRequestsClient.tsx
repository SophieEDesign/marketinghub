"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AssetUploadField } from "@/components/content/AssetUploadField";
import { ASSET_REQUEST_CATEGORIES } from "@/lib/data/collections";
import type {
  StaffRequest,
  StaffRequestKind,
  StaffRequestStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { RichTextView } from "@/components/ui/RichTextView";
import { plainTextFromHtml } from "@/lib/sanitize";

const KINDS: { id: StaffRequestKind; label: string }[] = [
  { id: "asset", label: "Asset request" },
  { id: "social_form", label: "Social media form" },
  { id: "other", label: "Other" },
];

const STATUSES: { id: StaffRequestStatus; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "in_progress", label: "In progress" },
  { id: "done", label: "Done" },
];

const emptyForm = {
  kind: "asset" as StaffRequestKind,
  category: "",
  title: "",
  details: "",
  requested_by: "",
  needed_by: "",
  attachment_url: "",
};

function isAssetKind(kind: StaffRequestKind) {
  return kind === "asset";
}

function allowsUpload(kind: StaffRequestKind) {
  return kind === "asset" || kind === "social_form";
}

export function StaffRequestsClient({
  initial,
  kind,
  startWithForm = false,
}: {
  initial: StaffRequest[];
  /** Lock list + new form to this request kind */
  kind?: StaffRequestKind;
  startWithForm?: boolean;
}) {
  const [items, setItems] = useState(initial);
  const [showForm, setShowForm] = useState(startWithForm);
  const [form, setForm] = useState({
    ...emptyForm,
    kind: kind ?? ("asset" as StaffRequestKind),
  });
  const [kindFilter, setKindFilter] = useState<string>(kind ?? "all");

  const refresh = useCallback(async () => {
    const res = await fetch("/api/staff-requests");
    const data = await res.json();
    setItems(data.requests ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!kind) return;
    setKindFilter(kind);
    setForm((f) => ({ ...f, kind }));
  }, [kind]);

  const filtered = useMemo(() => {
    if (kindFilter === "all") return items;
    return items.filter((i) => i.kind === kindFilter);
  }, [items, kindFilter]);

  const activeKind = kind ?? form.kind;

  const title =
    kind === "asset"
      ? "Asset requests"
      : kind === "social_form"
        ? "Social media forms"
        : kind === "other"
          ? "Other requests"
          : "Asset & form requests";

  const blurb =
    kind === "asset"
      ? "Ask marketing for photos, logos, decks, or other assets."
      : kind === "social_form"
        ? "Request or track an internal social media intake form (staff wins, events, etc.)."
        : kind === "other"
          ? "Anything else the marketing team can help with."
          : "Internal asks for assets, social media intake forms, and other staff marketing support.";

  async function create() {
    await fetch("/api/staff-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        kind: kind ?? form.kind,
        category: isAssetKind(kind ?? form.kind) ? form.category : "",
        attachment_url: form.attachment_url || "",
        needed_by: form.needed_by || null,
      }),
    });
    setShowForm(false);
    setForm({ ...emptyForm, kind: kind ?? "asset" });
    await refresh();
  }

  async function setStatus(id: string, status: StaffRequestStatus) {
    await fetch("/api/staff-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id, patch: { status } }),
    });
    await refresh();
  }

  async function remove(id: string) {
    await fetch("/api/staff-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    await refresh();
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl text-brand">{title}</h2>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setShowForm(true)}
        >
          New request
        </button>
      </div>

      <p className="mb-4 text-sm text-muted">{blurb}</p>

      {!kind ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm",
              kindFilter === "all"
                ? "border-brand bg-accent-soft text-brand"
                : "border-border text-muted"
            )}
            onClick={() => setKindFilter("all")}
          >
            All kinds
          </button>
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm",
                kindFilter === k.id
                  ? "border-brand bg-accent-soft text-brand"
                  : "border-border text-muted"
              )}
              onClick={() => setKindFilter(k.id)}
            >
              {k.label}
            </button>
          ))}
        </div>
      ) : null}

      {showForm ? (
        <div className="surface-card mb-6 grid gap-3 p-5 md:grid-cols-2">
          {!kind ? (
            <div>
              <label className="label">Kind</label>
              <select
                className="field"
                value={form.kind}
                onChange={(e) =>
                  setForm({
                    ...form,
                    kind: e.target.value as StaffRequestKind,
                    category:
                      e.target.value === "asset" ? form.category : "",
                  })
                }
              >
                {KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className={!kind ? undefined : "md:col-span-2"}>
            <label className="label">Requested by</label>
            <input
              className="field"
              value={form.requested_by}
              onChange={(e) =>
                setForm({ ...form, requested_by: e.target.value })
              }
            />
          </div>
          {isAssetKind(activeKind) ? (
            <div className="md:col-span-2">
              <label className="label">Asset type</label>
              <select
                className="field"
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value })
                }
              >
                <option value="">Select type…</option>
                {ASSET_REQUEST_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="md:col-span-2">
            <label className="label">Title</label>
            <input
              className="field"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={
                kind === "social_form" || activeKind === "social_form"
                  ? "e.g. Staff wins shout-out form"
                  : kind === "asset" || activeKind === "asset"
                    ? "e.g. High-res project photos for LinkedIn"
                    : "What do you need?"
              }
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">Details</label>
            <RichTextEditor
              value={form.details}
              onChange={(details) => setForm({ ...form, details })}
              placeholder="Details…"
              minHeight="88px"
            />
          </div>
          {allowsUpload(activeKind) ? (
            <div className="md:col-span-2">
              <AssetUploadField
                value={form.attachment_url}
                onChange={(url) =>
                  setForm({ ...form, attachment_url: url })
                }
                label={
                  activeKind === "social_form"
                    ? "Reference / draft media"
                    : "Reference file"
                }
                hint={
                  activeKind === "social_form"
                    ? "Optional image, PDF or short video for the social request · max 25MB."
                    : "Optional brief, draft, or example file · images, PDF or short video · max 25MB."
                }
              />
            </div>
          ) : null}
          <div>
            <label className="label">Needed by</label>
            <input
              type="date"
              className="field"
              value={form.needed_by}
              onChange={(e) => setForm({ ...form, needed_by: e.target.value })}
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void create()}
            >
              Submit
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <ul className="space-y-3">
        {filtered.map((item) => (
          <li key={item.id} className="surface-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {KINDS.find((k) => k.id === item.kind)?.label ?? item.kind}
                  {item.kind === "asset" && item.category
                    ? ` · ${item.category}`
                    : ""}
                </p>
                <p className="mt-1 font-medium">{item.title}</p>
                {plainTextFromHtml(item.details) ? (
                  <div className="mt-1 text-sm text-muted">
                    <RichTextView html={item.details} />
                  </div>
                ) : null}
                {item.attachment_url ? (
                  <a
                    href={item.attachment_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm text-brand underline-offset-2 hover:underline"
                  >
                    View attachment
                  </a>
                ) : null}
                <p className="mt-2 text-xs text-muted">
                  {item.requested_by || "Staff"}
                  {item.needed_by ? ` · needed ${item.needed_by}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="field py-1.5 text-sm"
                  value={item.status}
                  onChange={(e) =>
                    void setStatus(
                      item.id,
                      e.target.value as StaffRequestStatus
                    )
                  }
                >
                  {STATUSES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="text-sm text-muted hover:text-red-600"
                  onClick={() => void remove(item.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
        {filtered.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted">
            No requests yet.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
