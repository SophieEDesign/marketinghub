"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, ExternalLink } from "lucide-react";
import type { ReportLink } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";

const CATEGORY_ORDER = [
  "Website",
  "Ads",
  "SEO",
  "Enquiries",
  "Social",
  "Dashboards",
];

export function ReportsClient({ initial }: { initial: ReportLink[] }) {
  const [items, setItems] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    url: "",
    category: "Dashboards",
    tool: "",
  });

  const refresh = useCallback(async () => {
    const res = await fetch("/api/reports");
    const data = await res.json();
    setItems(data.reports ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const byCategory = useMemo(() => {
    const map = items.reduce<Record<string, ReportLink[]>>((acc, item) => {
      const key = item.category || "Dashboards";
      (acc[key] ??= []).push(item);
      return acc;
    }, {});
    const keys = [
      ...CATEGORY_ORDER.filter((c) => map[c]?.length),
      ...Object.keys(map).filter((k) => !CATEGORY_ORDER.includes(k)),
    ];
    return keys.map((k) => [k, map[k]] as const);
  }, [items]);

  async function create() {
    await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    setForm({
      title: "",
      description: "",
      url: "",
      category: "Dashboards",
      tool: "",
    });
    await refresh();
  }

  async function saveUrl(id: string) {
    await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        id,
        patch: { url: editUrl },
      }),
    });
    setEditingId(null);
    setEditUrl("");
    await refresh();
  }

  async function remove(id: string) {
    await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    await refresh();
  }

  return (
    <div>
      <PageHeader
        title="Reporting"
        description="One place to open the tools you already use — Analytics, Ads, SE Ranking, Looker Studio, enquiries. We link out rather than rebuild the data."
        actions={
          <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
            Add report link
          </button>
        }
      />

      <div className="surface-card mb-6 p-5 text-sm text-muted">
        <p className="font-medium text-foreground">Suggested stack</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Google Analytics</strong> — website traffic & behaviour
          </li>
          <li>
            <strong>Google Ads</strong> — paid campaign performance
          </li>
          <li>
            <strong>SE Ranking</strong> — SEO rankings & visibility
          </li>
          <li>
            <strong>Looker Studio</strong> (Data Studio) — one shared dashboard that pulls the above together
          </li>
          <li>
            <strong>Enquiries</strong> — form/CRM sheet or dashboard for web leads
          </li>
        </ul>
        <p className="mt-3">
          Paste your real share links below (replace the defaults).
        </p>
      </div>

      {showForm ? (
        <div className="surface-card mb-6 grid gap-3 p-5 md:grid-cols-2">
          {(
            [
              ["title", "Title"],
              ["tool", "Tool (e.g. Google Analytics)"],
              ["category", "Category"],
              ["url", "URL"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input
                className="field"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
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
        {byCategory.map(([category, list]) => (
          <section key={category}>
            <h2 className="mb-3 font-display text-xl text-brand">{category}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {list.map((item) => (
                <article key={item.id} className="surface-card p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-accent-soft p-2.5 text-brand">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium">{item.title}</h3>
                      <p className="text-xs text-muted">{item.tool}</p>
                      <p className="mt-1 text-sm text-muted">{item.description}</p>
                    </div>
                  </div>

                  {editingId === item.id ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <input
                        className="field flex-1"
                        placeholder="https://…"
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => void saveUrl(item.id)}
                      >
                        Save link
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-primary"
                        >
                          Open
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : (
                        <span className="btn-secondary pointer-events-none opacity-60">
                          No link yet
                        </span>
                      )}
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setEditingId(item.id);
                          setEditUrl(item.url);
                        }}
                      >
                        Edit link
                      </button>
                      <button
                        type="button"
                        className="btn-ghost text-[var(--danger)]"
                        onClick={() => void remove(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
