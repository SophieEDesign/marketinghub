"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Contact } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, matchesSearch } from "@/components/ui/FilterBar";

export function ContactsClient({ initial }: { initial: Contact[] }) {
  const [items, setItems] = useState(initial);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    organisation: "",
    role: "",
    email: "",
    phone: "",
    tags: "",
    notes: "",
  });

  const refresh = useCallback(async () => {
    const res = await fetch("/api/contacts");
    const data = await res.json();
    setItems(data.contacts ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const tags = useMemo(() => {
    const set = new Set(items.flatMap((c) => c.tags).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((c) => {
      if (
        !matchesSearch(search, [
          c.name,
          c.organisation,
          c.role,
          c.email,
          c.tags.join(" "),
          c.notes,
        ])
      ) {
        return false;
      }
      if (tagFilter !== "all" && !c.tags.includes(tagFilter)) return false;
      return true;
    });
  }, [items, search, tagFilter]);

  async function create() {
    await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    setForm({
      name: "",
      organisation: "",
      role: "",
      email: "",
      phone: "",
      tags: "",
      notes: "",
    });
    await refresh();
  }

  async function remove(id: string) {
    await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    await refresh();
  }

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="Press, partners, venues, and other marketing contacts."
        actions={
          <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
            Add contact
          </button>
        }
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name, organisation, email…"
        resultCount={filtered.length}
        totalCount={items.length}
        selects={[
          {
            id: "tag",
            label: "Tag",
            value: tagFilter,
            onChange: setTagFilter,
            options: [
              { value: "all", label: "All tags" },
              ...tags.map((t) => ({ value: t, label: t })),
            ],
          },
        ]}
      />

      {showForm ? (
        <div className="surface-card mb-6 grid gap-3 p-5 md:grid-cols-2">
          {(
            [
              ["name", "Name"],
              ["organisation", "Organisation"],
              ["role", "Role"],
              ["email", "Email"],
              ["phone", "Phone"],
              ["tags", "Tags (comma-separated)"],
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
            <label className="label">Notes</label>
            <textarea
              className="field min-h-[70px]"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
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

      <div className="surface-card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-sand/50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="hidden px-4 py-3 font-semibold md:table-cell">Organisation</th>
              <th className="hidden px-4 py-3 font-semibold lg:table-cell">Tags</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted md:hidden">{c.organisation}</p>
                </td>
                <td className="hidden px-4 py-3 md:table-cell">{c.organisation}</td>
                <td className="hidden px-4 py-3 lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {c.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-brand"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {c.email ? (
                    <a href={`mailto:${c.email}`} className="text-brand hover:underline">
                      {c.email}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="text-xs text-[var(--danger)]"
                    onClick={() => void remove(c.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted">No contacts match your search.</p>
        ) : null}
      </div>
    </div>
  );
}
