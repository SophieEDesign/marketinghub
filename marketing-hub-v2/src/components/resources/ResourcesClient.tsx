"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import type { ResourceLink } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";

export function ResourcesClient({
  initial,
  hideHeader = false,
  allowManage = true,
}: {
  initial: ResourceLink[];
  hideHeader?: boolean;
  /** When false (Member view), hide add/delete — open & download only. */
  allowManage?: boolean;
}) {
  const [items, setItems] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    url: "",
    category: "Press",
  });

  const refresh = useCallback(async () => {
    const res = await fetch("/api/resources");
    const data = await res.json();
    setItems(data.resources ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function create() {
    if (!allowManage) return;
    await fetch("/api/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    setForm({ title: "", description: "", url: "", category: "Press" });
    await refresh();
  }

  async function remove(id: string) {
    if (!allowManage) return;
    await fetch("/api/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    await refresh();
  }

  const byCategory = items.reduce<Record<string, ResourceLink[]>>((acc, item) => {
    const key = item.category || "General";
    (acc[key] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div>
      {hideHeader ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-brand">Resources</h2>
            {!allowManage ? (
              <p className="mt-0.5 text-xs text-muted">
                Open or download linked files
              </p>
            ) : null}
          </div>
          {allowManage ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowForm(true)}
            >
              Add link
            </button>
          ) : null}
        </div>
      ) : (
        <PageHeader
          title="Resources"
          description="Curated OneDrive / SharePoint links for press releases, brand kits, and templates."
          actions={
            allowManage ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => setShowForm(true)}
              >
                Add link
              </button>
            ) : undefined
          }
        />
      )}

      {allowManage && showForm ? (
        <div className="surface-card mb-6 grid gap-3 p-5 md:grid-cols-2">
          <div>
            <label className="label">Title</label>
            <input
              className="field"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Category</label>
            <input
              className="field"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">URL</label>
            <input
              className="field"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://…"
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">Description</label>
            <textarea
              className="field min-h-[70px]"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-primary" onClick={() => void create()}>
              Save
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-8">
        {Object.entries(byCategory).map(([category, list]) => (
          <section key={category}>
            <h2 className="mb-3 font-display text-xl text-brand">{category}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {list.map((item) => (
                <article key={item.id} className="surface-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium">{item.title}</h3>
                      <p className="mt-1 text-sm text-muted">{item.description}</p>
                    </div>
                    {allowManage ? (
                      <button
                        type="button"
                        className="text-xs text-[var(--danger)]"
                        onClick={() => void remove(item.id)}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                  {item.url ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary"
                      >
                        Open link
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <a
                        href={item.url}
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="btn-primary"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </a>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
