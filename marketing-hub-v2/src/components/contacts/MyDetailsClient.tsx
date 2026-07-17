"use client";

import { useCallback, useEffect, useState } from "react";
import type { Contact } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { RichTextView } from "@/components/ui/RichTextView";

const emptyForm = {
  name: "",
  organisation: "",
  role: "",
  email: "",
  phone: "",
  tags: "",
  notes: "",
};

type FormState = typeof emptyForm;

function toForm(c: Contact): FormState {
  return {
    name: c.name,
    organisation: c.organisation,
    role: c.role,
    email: c.email,
    phone: c.phone,
    tags: c.tags.join(", "),
    notes: c.notes,
  };
}

export function MyDetailsClient() {
  const [contact, setContact] = useState<Contact | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/me/contact");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not load your details");
        setContact(null);
        return;
      }
      const next = (data.contact as Contact | null) ?? null;
      setContact(next);
      if (next) setForm(toForm(next));
    } catch {
      setError("Could not load your details");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/me/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: contact ? "update" : "create",
          ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save");
        return;
      }
      setContact(data.contact);
      setForm(toForm(data.contact));
      setEditing(false);
      setMessage("Saved");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="My details"
        description="Your contact profile used across the hub (owners, directories)."
        actions={
          !loading && !editing ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                if (!contact) {
                  setForm(emptyForm);
                }
                setEditing(true);
                setMessage(null);
              }}
            >
              {contact ? "Edit" : "Create my contact"}
            </button>
          ) : null
        }
      />

      {error ? (
        <p className="mb-4 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/5 px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mb-4 text-sm text-brand">{message}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : editing ? (
        <div className="surface-card grid max-w-2xl gap-3 p-5 md:grid-cols-2">
          {(
            [
              ["name", "Name"],
              ["organisation", "Organisation"],
              ["role", "Role / job title"],
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
            <RichTextEditor
              value={form.notes}
              onChange={(notes) => setForm({ ...form, notes })}
              placeholder="Notes…"
              minHeight="70px"
            />
          </div>
          <div className="flex gap-2 md:col-span-2">
            <button
              type="button"
              className="btn-primary"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setEditing(false);
                if (contact) setForm(toForm(contact));
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : contact ? (
        <div className="surface-card max-w-2xl space-y-3 p-5">
          <h2 className="font-display text-xl text-brand">{contact.name}</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="label !mb-0.5">Organisation</dt>
              <dd>{contact.organisation || "—"}</dd>
            </div>
            <div>
              <dt className="label !mb-0.5">Role</dt>
              <dd>{contact.role || "—"}</dd>
            </div>
            <div>
              <dt className="label !mb-0.5">Email</dt>
              <dd>{contact.email || "—"}</dd>
            </div>
            <div>
              <dt className="label !mb-0.5">Phone</dt>
              <dd>{contact.phone || "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="label !mb-0.5">Tags</dt>
              <dd>
                {contact.tags.length > 0 ? contact.tags.join(", ") : "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="label !mb-0.5">Notes</dt>
              <dd>
                <RichTextView html={contact.notes} />
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <div className="surface-card max-w-2xl p-5 text-sm text-muted">
          <p>
            No contact is linked to your account yet. Create one here, or ask an
            admin to link you to an existing contact under Contacts or Users.
          </p>
        </div>
      )}
    </div>
  );
}
