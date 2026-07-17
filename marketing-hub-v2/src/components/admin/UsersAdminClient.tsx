"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Contact, HubAccessRole, HubUser } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, matchesSearch } from "@/components/ui/FilterBar";
import { cn } from "@/lib/utils";

const ROLE_OPTIONS: {
  value: HubAccessRole;
  label: string;
  hint: string;
  process: string[];
}[] = [
  {
    value: "admin",
    label: "Admin",
    hint: "Full hub + data tables",
    process: [
      "Full hub access plus Admin → Users and data tables.",
      "Use sparingly — prefer Member for day-to-day staff.",
    ],
  },
  {
    value: "member",
    label: "Member",
    hint: "Day-to-day staff access",
    process: [
      "Invite → they set a password from the email.",
      "Sign in at /login → land in /app as staff.",
      "Optional: link a Contact so they can edit My details.",
    ],
  },
  {
    value: "external",
    label: "External",
    hint: "Outside / media access",
    process: [
      "Invite → they set a password from the email.",
      "Sign in → redirected to /media only (no /app).",
      "Mark relevant Media folders Public so they can see them.",
    ],
  },
];

function roleBadgeClass(role: HubAccessRole) {
  if (role === "admin") return "bg-brand/10 text-brand";
  if (role === "member") return "bg-accent-soft text-brand";
  return "bg-sand text-muted";
}

function formatSignIn(value: string | null | undefined) {
  if (!value) return "Never";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function UsersAdminClient({
  initial,
  initialSource = "local",
}: {
  initial: HubUser[];
  initialSource?: "supabase" | "local";
}) {
  const [items, setItems] = useState(initial);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [source, setSource] = useState<"supabase" | "local">(initialSource);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    role: "member" as HubAccessRole,
    notes: "",
  });

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to load users");
      return;
    }
    setItems(data.users ?? []);
    setSource(data.source === "supabase" ? "supabase" : "local");
    setError(null);
  }, []);

  const refreshContacts = useCallback(async () => {
    try {
      const res = await fetch("/api/contacts");
      if (!res.ok) return;
      const data = await res.json();
      setContacts(data.contacts ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refresh();
    void refreshContacts();
  }, [refresh, refreshContacts]);

  const contactByUserId = useMemo(() => {
    const map = new Map<string, Contact>();
    for (const c of contacts) {
      if (c.user_id) map.set(c.user_id, c);
    }
    return map;
  }, [contacts]);

  const counts = useMemo(() => {
    return {
      admin: items.filter((u) => u.role === "admin").length,
      member: items.filter((u) => u.role === "member").length,
      external: items.filter((u) => u.role === "external").length,
    };
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((u) => {
      if (!matchesSearch(search, [u.full_name, u.email, u.role, u.notes])) {
        return false;
      }
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      return true;
    });
  }, [items, search, roleFilter]);

  const selectedRoleOption =
    ROLE_OPTIONS.find((r) => r.value === form.role) ?? ROLE_OPTIONS[1];

  async function create() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not add user");
      return;
    }
    setShowForm(false);
    setForm({ full_name: "", email: "", role: "member", notes: "" });
    await refresh();
  }

  async function setRole(id: string, role: HubAccessRole) {
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id, patch: { role } }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not update role");
      return;
    }
    await refresh();
  }

  async function setContactLink(userId: string, contactId: string) {
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        id: userId,
        patch: { contact_id: contactId || null },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not link contact");
      return;
    }
    await refreshContacts();
  }

  async function remove(id: string) {
    if (
      !window.confirm(
        source === "supabase"
          ? "Remove this user from Supabase Auth? They will no longer be able to sign in."
          : "Remove this user?"
      )
    ) {
      return;
    }
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not remove user");
      return;
    }
    await refresh();
  }

  return (
    <div>
      <PageHeader
        title="Users"
        description={
          source === "supabase"
            ? "Supabase Auth users and profile roles — Admin, Member, or External."
            : "Local demo users. Set SUPABASE_SERVICE_ROLE_KEY to manage live Supabase users."
        }
        actions={
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowForm(true)}
          >
            {source === "supabase" ? "Invite user" : "Add user"}
          </button>
        }
      />

      <p className="mb-4 text-xs text-muted">
        Source:{" "}
        <span className="font-medium text-foreground">
          {source === "supabase" ? "Supabase Auth + profiles" : "Local store"}
        </span>
      </p>

      {error ? (
        <p className="mb-4 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/5 px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {ROLE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() =>
              setRoleFilter(roleFilter === opt.value ? "all" : opt.value)
            }
            className={cn(
              "surface-card p-4 text-left transition",
              roleFilter === opt.value && "border-accent ring-1 ring-accent"
            )}
          >
            <p className="text-xs uppercase tracking-wide text-muted">
              {opt.label}
            </p>
            <p className="mt-1 font-display text-2xl text-brand">
              {counts[opt.value]}
            </p>
            <p className="mt-1 text-xs text-muted">{opt.hint}</p>
          </button>
        ))}
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name, email…"
        resultCount={filtered.length}
        totalCount={items.length}
        selects={[
          {
            id: "role",
            label: "Role",
            value: roleFilter,
            onChange: setRoleFilter,
            options: [
              { value: "all", label: "All roles" },
              ...ROLE_OPTIONS.map((r) => ({
                value: r.value,
                label: r.label,
              })),
            ],
          },
        ]}
      />

      {showForm ? (
        <div className="surface-card mb-6 grid gap-3 p-5 md:grid-cols-2">
          <div>
            <label className="label">Full name</label>
            <input
              className="field"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="field"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Access role</label>
            <select
              className="field"
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as HubAccessRole })
              }
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Notes</label>
            <input
              className="field"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="rounded-xl border border-border bg-sand/40 px-4 py-3 text-xs text-muted md:col-span-2">
            <p className="font-medium text-foreground">
              {selectedRoleOption.label}: suggested process
            </p>
            <ul className="mt-1.5 list-inside list-disc space-y-0.5">
              {selectedRoleOption.process.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
            {source === "supabase" ? (
              <p className="mt-2">
                Sends a Supabase invite email. Role is stored on{" "}
                <code className="text-[11px]">profiles</code> and{" "}
                <code className="text-[11px]">app_metadata</code>.
              </p>
            ) : null}
          </div>
          <div className="flex gap-2 md:col-span-2">
            <button
              type="button"
              className="btn-primary"
              disabled={saving}
              onClick={() => void create()}
            >
              {saving
                ? "Saving…"
                : source === "supabase"
                  ? "Send invite"
                  : "Save"}
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

      <div className="surface-card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-sand/50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="hidden px-4 py-3 font-semibold lg:table-cell">
                Linked contact
              </th>
              <th className="hidden px-4 py-3 font-semibold md:table-cell">
                Last sign-in
              </th>
              <th className="hidden px-4 py-3 font-semibold xl:table-cell">
                Notes
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{u.full_name || "—"}</td>
                <td className="px-4 py-3">
                  {u.email ? (
                    <a
                      href={`mailto:${u.email}`}
                      className="text-brand hover:underline"
                    >
                      {u.email}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  <select
                    className={cn(
                      "rounded-lg border-0 px-2 py-1 text-xs font-medium",
                      roleBadgeClass(u.role)
                    )}
                    value={u.role}
                    onChange={(e) =>
                      void setRole(u.id, e.target.value as HubAccessRole)
                    }
                    aria-label={`Role for ${u.full_name || u.email}`}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="hidden px-4 py-3 lg:table-cell">
                  <select
                    className="field !py-1 text-xs"
                    value={contactByUserId.get(u.id)?.id ?? ""}
                    onChange={(e) => void setContactLink(u.id, e.target.value)}
                    aria-label={`Linked contact for ${u.full_name || u.email}`}
                  >
                    <option value="">None</option>
                    {contacts.map((c) => {
                      const takenByOther =
                        !!c.user_id && c.user_id !== u.id;
                      return (
                        <option
                          key={c.id}
                          value={c.id}
                          disabled={takenByOther}
                        >
                          {c.name}
                          {c.organisation ? ` · ${c.organisation}` : ""}
                          {takenByOther ? " (linked)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </td>
                <td className="hidden px-4 py-3 text-muted md:table-cell">
                  {formatSignIn(u.last_sign_in_at)}
                </td>
                <td className="hidden px-4 py-3 text-muted xl:table-cell">
                  {u.notes || "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="text-xs text-[var(--danger)]"
                    onClick={() => void remove(u.id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted">
            No users match your search. Invite someone above.
          </p>
        ) : null}
      </div>
    </div>
  );
}
