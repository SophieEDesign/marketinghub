"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Contact, HubUser } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, matchesSearch } from "@/components/ui/FilterBar";
import { useHubView } from "@/lib/hub-view";

const emptyForm = {
  name: "",
  organisation: "",
  role: "",
  email: "",
  phone: "",
  tags: "",
  notes: "",
  user_id: "",
};

type ContactForm = typeof emptyForm;

function toForm(c: Contact): ContactForm {
  return {
    name: c.name,
    organisation: c.organisation,
    role: c.role,
    email: c.email,
    phone: c.phone,
    tags: c.tags.join(", "),
    notes: c.notes,
    user_id: c.user_id ?? "",
  };
}

function parseTags(tags: string | string[]) {
  return Array.isArray(tags)
    ? tags
    : String(tags ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
}

export function ContactsClient({ initial }: { initial: Contact[] }) {
  const { canToggleAdminView } = useHubView();
  const canDelete = canToggleAdminView;

  const [items, setItems] = useState(initial);
  const [users, setUsers] = useState<HubUser[]>([]);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [selected, setSelected] = useState<Contact | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<ContactForm | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/contacts");
    const data = await res.json();
    setItems(data.contacts ?? []);
  }, []);

  const refreshUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) return;
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
      /* non-admin / unavailable */
    }
  }, []);

  useEffect(() => {
    void refresh();
    void refreshUsers();
  }, [refresh, refreshUsers]);

  useEffect(() => {
    if (!selected) return;
    const next = items.find((c) => c.id === selected.id) ?? null;
    setSelected(next);
    // Only re-sync when the list or selected id changes, not on every selected object update.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selected intentionally omitted
  }, [items, selected?.id]);

  const userById = useMemo(() => {
    const map = new Map(users.map((u) => [u.id, u]));
    return map;
  }, [users]);

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
          c.user_id ? userById.get(c.user_id)?.full_name ?? "" : "",
          c.user_id ? userById.get(c.user_id)?.email ?? "" : "",
        ])
      ) {
        return false;
      }
      if (tagFilter !== "all" && !c.tags.includes(tagFilter)) return false;
      return true;
    });
  }, [items, search, tagFilter, userById]);

  async function create() {
    await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        user_id: form.user_id || null,
      }),
    });
    setShowForm(false);
    setForm(emptyForm);
    await refresh();
  }

  function openEdit(contact: Contact) {
    setEditingId(contact.id);
    setEdit(toForm(contact));
  }

  function closeEdit() {
    setEditingId(null);
    setEdit(null);
  }

  async function saveEdit() {
    if (!editingId || !edit) return;
    setSaving(true);
    try {
      await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          id: editingId,
          patch: {
            name: edit.name.trim() || "Contact",
            organisation: edit.organisation,
            role: edit.role,
            email: edit.email,
            phone: edit.phone,
            tags: parseTags(edit.tags),
            notes: edit.notes,
            user_id: edit.user_id || null,
          },
        }),
      });
      closeEdit();
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!canDelete) return;
    if (!window.confirm("Delete this contact?")) return;
    await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    if (selected?.id === id) setSelected(null);
    if (editingId === id) closeEdit();
    await refresh();
  }

  function linkedLabel(userId: string | null | undefined) {
    if (!userId) return null;
    const u = userById.get(userId);
    if (!u) return "Linked user";
    return u.full_name || u.email || "Linked user";
  }

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="Press, partners, venues, and staff — link a hub user so they can edit their own details."
        actions={
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowForm(true)}
          >
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
          <ContactFields form={form} onChange={setForm} users={users} />
          <div className="flex gap-2 md:col-span-2">
            <button type="button" className="btn-primary" onClick={() => void create()}>
              Save
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="surface-card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-sand/50 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="hidden px-4 py-3 font-semibold md:table-cell">
                  Organisation
                </th>
                <th className="hidden px-4 py-3 font-semibold lg:table-cell">
                  Tags
                </th>
                <th className="px-4 py-3 font-semibold">Email</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className={`cursor-pointer border-b border-border last:border-0 hover:bg-sand ${
                    selected?.id === c.id ? "bg-accent-soft/50" : ""
                  }`}
                  onClick={() => setSelected(c)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted md:hidden">{c.organisation}</p>
                    {c.user_id ? (
                      <p className="mt-0.5 text-[11px] text-brand">
                        Hub: {linkedLabel(c.user_id)}
                      </p>
                    ) : null}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {c.organisation || "—"}
                  </td>
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
                      {c.tags.length === 0 ? (
                        <span className="text-muted">—</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {c.email ? (
                      <a
                        href={`mailto:${c.email}`}
                        className="text-brand hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <p className="p-6 text-sm text-muted">No contacts match your search.</p>
          ) : null}
        </div>

        <aside className="surface-card h-fit p-5 lg:sticky lg:top-6">
          {selected ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-display text-xl text-brand">{selected.name}</h2>
                <button
                  type="button"
                  className="btn-ghost shrink-0 px-2 py-1 text-xs"
                  onClick={() => setSelected(null)}
                >
                  Clear
                </button>
              </div>

              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="label !mb-0.5">Organisation</dt>
                  <dd>{selected.organisation || "—"}</dd>
                </div>
                <div>
                  <dt className="label !mb-0.5">Role</dt>
                  <dd>{selected.role || "—"}</dd>
                </div>
                <div>
                  <dt className="label !mb-0.5">Email</dt>
                  <dd>
                    {selected.email ? (
                      <a
                        href={`mailto:${selected.email}`}
                        className="text-brand hover:underline"
                      >
                        {selected.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="label !mb-0.5">Phone</dt>
                  <dd>
                    {selected.phone ? (
                      <a
                        href={`tel:${selected.phone}`}
                        className="text-brand hover:underline"
                      >
                        {selected.phone}
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="label !mb-0.5">Linked hub user</dt>
                  <dd>
                    {selected.user_id ? (
                      <span className="text-brand">
                        {linkedLabel(selected.user_id)}
                      </span>
                    ) : (
                      <span className="text-muted">Not linked</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="label !mb-0.5">Tags</dt>
                  <dd>
                    {selected.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {selected.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-brand"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="label !mb-0.5">Notes</dt>
                  <dd className="whitespace-pre-wrap text-foreground/90">
                    {selected.notes || "—"}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => openEdit(selected)}
                >
                  Edit
                </button>
                {canDelete ? (
                  <button
                    type="button"
                    className="btn-ghost text-[var(--danger)]"
                    onClick={() => void remove(selected.id)}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">
              Select a contact to view details, edit, or link a hub user.
            </p>
          )}
        </aside>
      </div>

      {edit && editingId ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/25 md:left-sidebar"
            onClick={closeEdit}
            aria-hidden
          />
          <aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-white shadow-soft"
            role="dialog"
            aria-modal="true"
            aria-label="Edit contact"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-brand">Edit contact</h2>
              <button
                type="button"
                className="btn-ghost px-2.5 py-1.5 text-xs"
                onClick={closeEdit}
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <ContactFields form={edit} onChange={setEdit} users={users} />
            </div>
            <div className="flex gap-2 border-t border-border px-4 py-3">
              <button
                type="button"
                className="btn-primary"
                disabled={saving}
                onClick={() => void saveEdit()}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button type="button" className="btn-secondary" onClick={closeEdit}>
                Cancel
              </button>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}

function ContactFields({
  form,
  onChange,
  users,
}: {
  form: ContactForm;
  onChange: (next: ContactForm) => void;
  users: HubUser[];
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
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
            onChange={(e) => onChange({ ...form, [key]: e.target.value })}
          />
        </div>
      ))}
      <div className="md:col-span-2">
        <label className="label">Linked hub user</label>
        <select
          className="field"
          value={form.user_id}
          onChange={(e) => onChange({ ...form, user_id: e.target.value })}
        >
          <option value="">None</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name || u.email} ({u.role})
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted">
          Linked members can edit this contact under My details.
        </p>
      </div>
      <div className="md:col-span-2">
        <label className="label">Notes</label>
        <textarea
          className="field min-h-[70px]"
          value={form.notes}
          onChange={(e) => onChange({ ...form, notes: e.target.value })}
        />
      </div>
    </div>
  );
}
