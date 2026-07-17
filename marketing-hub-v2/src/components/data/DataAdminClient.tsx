"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  BulkValueControl,
  FieldControl,
  parseTypedValue,
} from "@/components/data/FieldControl";
import { FieldManagerPanel } from "@/components/data/FieldManagerPanel";
import type { FieldDef, FieldOption, FieldType } from "@/lib/data/collections";
import { cn } from "@/lib/utils";

type CollectionSummary = {
  key: string;
  label: string;
  description: string;
};

type TablePayload = {
  collection: string;
  label: string;
  description: string;
  fields: FieldDef[];
  rows: Record<string, unknown>[];
  count: number;
};

type SortDir = "asc" | "desc";

function sortValue(field: FieldDef | undefined, value: unknown): string | number {
  if (value == null || value === "") return "";
  const type = field?.type ?? "text";
  if (type === "number") {
    const n = Number(value);
    return Number.isNaN(n) ? "" : n;
  }
  if (type === "date" || type === "datetime") {
    const t = Date.parse(String(value));
    return Number.isNaN(t) ? String(value) : t;
  }
  if (Array.isArray(value)) return value.map(String).join(", ").toLowerCase();
  return String(value).toLowerCase();
}

export function DataAdminClient() {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [active, setActive] = useState<string>("events");
  const [table, setTable] = useState<TablePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkField, setBulkField] = useState("");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [fieldManagerOpen, setFieldManagerOpen] = useState(false);
  const [fieldManagerKey, setFieldManagerKey] = useState<string | null>(null);
  const [fieldBusy, setFieldBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const loadCollections = useCallback(async () => {
    const res = await fetch("/api/data");
    const data = await res.json();
    setCollections(data.collections ?? []);
  }, []);

  const loadTable = useCallback(async (key: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/data?collection=${encodeURIComponent(key)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setTable(data);
      setSelected(new Set());
      setBulkField("");
      setBulkValue("");
      setSortKey(null);
      setSortDir("asc");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setTable(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCollections();
  }, [loadCollections]);

  useEffect(() => {
    void loadTable(active);
  }, [active, loadTable]);

  const filteredRows = useMemo(() => {
    if (!table) return [];
    const q = search.trim().toLowerCase();
    let rows = table.rows;
    if (q) {
      rows = rows.filter((row) =>
        Object.values(row).some((v) =>
          String(v ?? "")
            .toLowerCase()
            .includes(q)
        )
      );
    }
    if (!sortKey) return rows;

    const field = table.fields.find((f) => f.key === sortKey);
    const sorted = [...rows].sort((a, b) => {
      const av = sortValue(field, a[sortKey]);
      const bv = sortValue(field, b[sortKey]);
      if (av === "" && bv !== "") return 1;
      if (bv === "" && av !== "") return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return av - bv;
      }
      return String(av).localeCompare(String(bv), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
    return sortDir === "asc" ? sorted : sorted.reverse();
  }, [table, search, sortKey, sortDir]);

  function toggleSort(fieldKey: string) {
    if (sortKey !== fieldKey) {
      setSortKey(fieldKey);
      setSortDir("asc");
      return;
    }
    if (sortDir === "asc") {
      setSortDir("desc");
      return;
    }
    setSortKey(null);
    setSortDir("asc");
  }

  function openFieldManager(key?: string | null) {
    setFieldError(null);
    setFieldManagerKey(key ?? null);
    setFieldManagerOpen(true);
  }

  function closeFieldManager() {
    setFieldManagerOpen(false);
    setFieldManagerKey(null);
    setFieldError(null);
  }

  const editableFields = useMemo(
    () =>
      (table?.fields ?? []).filter(
        (f) => !f.locked && f.type !== "readonly" && f.key !== "id"
      ),
    [table]
  );

  const bulkFieldDef =
    editableFields.find((f) => f.key === bulkField) ?? null;

  const allFilteredSelected =
    filteredRows.length > 0 &&
    filteredRows.every((r) => selected.has(String(r.id)));

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllFiltered() {
    setSelected((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        for (const row of filteredRows) next.delete(String(row.id));
        return next;
      }
      const next = new Set(prev);
      for (const row of filteredRows) next.add(String(row.id));
      return next;
    });
  }

  async function commitCell(id: string, field: string, value: unknown) {
    const res = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "updateCell",
        collection: active,
        id,
        field,
        value,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Save failed");
      return;
    }
    setTable((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: prev.rows.map((r) =>
          String(r.id) === id ? (data.row as Record<string, unknown>) : r
        ),
      };
    });
  }

  async function handleBulkEdit() {
    if (!table || selected.size === 0 || !bulkField || !bulkFieldDef) return;
    const value = parseTypedValue(bulkFieldDef, bulkValue);

    if (
      !window.confirm(
        `Set “${bulkFieldDef.label}” on ${selected.size} selected row(s)?`
      )
    ) {
      return;
    }

    setBulkBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulkUpdate",
          collection: active,
          ids: Array.from(selected),
          field: bulkField,
          value,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bulk edit failed");
      setBulkValue("");
      await loadTable(active);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk edit failed");
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (
      !window.confirm(
        `Delete ${selected.size} selected row(s)? This cannot be undone.`
      )
    ) {
      return;
    }
    setBulkBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulkDelete",
          collection: active,
          ids: Array.from(selected),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bulk delete failed");
      await loadTable(active);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk delete failed");
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleAddRow() {
    const res = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "addRow", collection: active }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not add row");
      return;
    }
    await loadTable(active);
  }

  async function handleDeleteRow(id: string) {
    if (!window.confirm("Delete this row?")) return;
    await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "deleteRow",
        collection: active,
        id,
      }),
    });
    await loadTable(active);
  }

  async function handleSaveField(payload: {
    mode: "create" | "update";
    key: string;
    label: string;
    type: FieldType;
    options?: FieldOption[];
    newKey?: string;
  }) {
    setFieldBusy(true);
    setFieldError(null);
    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          payload.mode === "create"
            ? {
                action: "addField",
                collection: active,
                name: payload.key || payload.label,
                label: payload.label,
                type: payload.type,
                options: payload.options,
              }
            : {
                action: "updateField",
                collection: active,
                key: payload.key,
                label: payload.label,
                type: payload.type,
                options: payload.options,
                newKey: payload.newKey,
              }
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save field");
      await loadTable(active);
      const savedKey =
        (data.field?.key as string | undefined) ||
        payload.newKey ||
        payload.key;
      setFieldManagerKey(savedKey);
    } catch (e) {
      setFieldError(e instanceof Error ? e.message : "Could not save field");
    } finally {
      setFieldBusy(false);
    }
  }

  async function handleRemoveField(name: string, locked?: boolean) {
    if (locked) return;
    if (
      !window.confirm(
        `Remove field “${name}” from this table? Values will be deleted from all rows.`
      )
    ) {
      return;
    }
    setFieldBusy(true);
    setFieldError(null);
    setError(null);
    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "removeField",
          collection: active,
          name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not remove field");
      await loadTable(active);
      if (fieldManagerKey === name) {
        setFieldManagerKey(null);
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Could not remove field";
      setFieldError(message);
      setError(message);
    } finally {
      setFieldBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] flex-col gap-4 md:h-[calc(100dvh-4.5rem)]">
      <div className="shrink-0">
        <PageHeader
          title="Data"
          description="Raw tables with typed fields — dates, dropdowns, status pills, and bulk edit."
        />

        {error ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
      </div>

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="surface-card h-fit max-h-full overflow-y-auto p-2 lg:max-h-none lg:h-full">
          <p className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Tables
          </p>
          <nav className="flex flex-col gap-0.5">
            {collections.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => {
                  closeFieldManager();
                  setActive(c.key);
                }}
                className={cn(
                  "rounded-lg px-3 py-2 text-left text-sm transition",
                  active === c.key
                    ? "bg-accent-soft font-medium text-brand"
                    : "text-muted hover:bg-sand hover:text-foreground"
                )}
              >
                <span className="block">{c.label}</span>
                <span className="block text-[11px] opacity-70">{c.key}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-col gap-4">
          <div className="shrink-0 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-xl text-brand">
                  {table?.label ?? active}
                </h2>
                <p className="text-sm text-muted">
                  {table?.description}
                  {table ? ` · ${table.count} rows` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  className="field w-44"
                  placeholder="Search rows…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => openFieldManager(null)}
                >
                  <Settings2 className="h-4 w-4" />
                  Manage fields
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void handleAddRow()}
                >
                  <Plus className="h-4 w-4" />
                  Add row
                </button>
              </div>
            </div>

            {selected.size > 0 ? (
              <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-brand/30 bg-accent-soft/50 p-3">
                <p className="w-full text-sm font-medium text-brand">
                  Bulk edit · {selected.size} selected
                </p>
                <div className="min-w-[140px]">
                  <label className="label">Field</label>
                  <select
                    className="field"
                    value={bulkField}
                    onChange={(e) => {
                      setBulkField(e.target.value);
                      setBulkValue("");
                    }}
                  >
                    <option value="">Choose field…</option>
                    {editableFields.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[200px] flex-1">
                  <label className="label">New value</label>
                  <BulkValueControl
                    field={bulkFieldDef}
                    value={bulkValue}
                    onChange={setBulkValue}
                  />
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={bulkBusy || !bulkField}
                  onClick={() => void handleBulkEdit()}
                >
                  {bulkBusy ? "Updating…" : "Apply to selected"}
                </button>
                <button
                  type="button"
                  className="btn-ghost text-[var(--danger)]"
                  disabled={bulkBusy}
                  onClick={() => void handleBulkDelete()}
                >
                  Delete selected
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={bulkBusy}
                  onClick={() => setSelected(new Set())}
                >
                  Clear selection
                </button>
              </div>
            ) : null}
          </div>

          {loading ? (
            <p className="shrink-0 text-sm text-muted">Loading table…</p>
          ) : table ? (
            <div className="data-table-scroll min-h-0 flex-1 overflow-auto rounded-2xl border border-border bg-white shadow-soft">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 bg-sand/95 backdrop-blur">
                  <tr>
                    <th className="w-10 border-b border-border px-2 py-2">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAllFiltered}
                        aria-label="Select all visible rows"
                      />
                    </th>
                    {table.fields.map((field) => {
                      const activeSort = sortKey === field.key;
                      return (
                        <th
                          key={field.key}
                          className="border-b border-border px-2 py-2 font-semibold text-brand"
                        >
                          <div className="flex min-w-[140px] items-center justify-between gap-1">
                            <button
                              type="button"
                              className="flex min-w-0 items-center gap-1 rounded-lg px-1 py-0.5 text-left hover:bg-white/80"
                              title={`Sort by ${field.label}`}
                              onClick={() => toggleSort(field.key)}
                            >
                              <span className="truncate">
                                {field.label}
                                <span className="ml-1 text-[10px] font-normal uppercase text-muted">
                                  {field.type}
                                </span>
                              </span>
                              {activeSort ? (
                                sortDir === "asc" ? (
                                  <ArrowUp className="h-3.5 w-3.5 shrink-0" />
                                ) : (
                                  <ArrowDown className="h-3.5 w-3.5 shrink-0" />
                                )
                              ) : (
                                <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-muted/60" />
                              )}
                            </button>
                            <div className="flex shrink-0 items-center">
                              <button
                                type="button"
                                className="rounded p-1 text-muted hover:bg-white hover:text-brand"
                                title={`Edit field ${field.label}`}
                                onClick={() => openFieldManager(field.key)}
                              >
                                <Settings2 className="h-3.5 w-3.5" />
                              </button>
                              {!field.locked ? (
                                <button
                                  type="button"
                                  className="rounded p-1 text-muted hover:bg-white hover:text-red-600"
                                  title={`Remove ${field.key}`}
                                  onClick={() =>
                                    void handleRemoveField(
                                      field.key,
                                      field.locked
                                    )
                                  }
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </th>
                      );
                    })}
                    <th className="w-12 border-b border-border px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const id = String(row.id ?? "");
                    const isSelected = selected.has(id);
                    return (
                      <tr
                        key={id}
                        className={cn(
                          "hover:bg-sand/40",
                          isSelected && "bg-accent-soft/40"
                        )}
                      >
                        <td className="border-b border-border px-2 py-1 align-top">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(id)}
                            aria-label={`Select row ${id}`}
                          />
                        </td>
                        {table.fields.map((field) => (
                          <td
                            key={field.key}
                            className="border-b border-border px-1 py-1 align-top"
                          >
                            <FieldControl
                              field={field}
                              value={row[field.key]}
                              compact
                              onCommit={(next) =>
                                void commitCell(id, field.key, next)
                              }
                            />
                          </td>
                        ))}
                        <td className="border-b border-border px-2 py-1">
                          <button
                            type="button"
                            className="rounded p-1.5 text-muted hover:bg-sand hover:text-red-600"
                            title="Delete row"
                            onClick={() => void handleDeleteRow(id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={table.fields.length + 2}
                        className="px-4 py-10 text-center text-muted"
                      >
                        No rows
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      <FieldManagerPanel
        open={fieldManagerOpen}
        fields={table?.fields ?? []}
        collectionLabel={table?.label ?? active}
        busy={fieldBusy}
        error={fieldError}
        initialKey={fieldManagerKey}
        onClose={closeFieldManager}
        onSave={handleSaveField}
        onDelete={(key) => handleRemoveField(key)}
      />
    </div>
  );
}
