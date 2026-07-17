"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MerchInventoryItem } from "@/lib/types";
import { FilterBar, matchesSearch } from "@/components/ui/FilterBar";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { plainTextFromHtml } from "@/lib/sanitize";
import {
  CLOTHING_FITS,
  CLOTHING_PRODUCTS,
  INVENTORY_SIZES,
  coloursForItem,
  defaultBrandForItem,
  defaultColourForItem,
  type ClothingFit,
} from "@/lib/merch/north-sails";

const DEFAULT_ITEM = CLOTHING_PRODUCTS[0]!.label;

const emptyForm = {
  item: DEFAULT_ITEM,
  brand: defaultBrandForItem(DEFAULT_ITEM),
  fit: "male" as ClothingFit | "",
  size: "M",
  colour: defaultColourForItem(DEFAULT_ITEM),
  quantity: "1",
  notes: "",
};

type EditForm = typeof emptyForm;

function toEditForm(row: MerchInventoryItem): EditForm {
  return {
    item: row.item,
    brand: row.brand || defaultBrandForItem(row.item),
    fit: (row.fit as ClothingFit | "") || "",
    size: row.size || "M",
    colour: row.colour || defaultColourForItem(row.item),
    quantity: String(row.quantity),
    notes: row.notes,
  };
}

function fitLabel(fit: string) {
  if (fit === "female") return "Female";
  if (fit === "male") return "Male";
  return "—";
}

function applyItemChange(form: EditForm, item: string): EditForm {
  const colours = coloursForItem(item);
  const colour = colours.includes(form.colour)
    ? form.colour
    : defaultColourForItem(item);
  return {
    ...form,
    item,
    brand: defaultBrandForItem(item),
    colour,
  };
}

function InventoryFields({
  form,
  onChange,
}: {
  form: EditForm;
  onChange: (next: EditForm) => void;
}) {
  const colours = coloursForItem(form.item);

  return (
    <>
      <div>
        <label className="label">Item</label>
        <select
          className="field"
          value={form.item}
          onChange={(e) => onChange(applyItemChange(form, e.target.value))}
        >
          {CLOTHING_PRODUCTS.map((p) => (
            <option key={p.id} value={p.label}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Brand</label>
        <input
          className="field"
          value={form.brand}
          onChange={(e) => onChange({ ...form, brand: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Fit</label>
        <select
          className="field"
          value={form.fit}
          onChange={(e) =>
            onChange({
              ...form,
              fit: e.target.value as ClothingFit | "",
            })
          }
        >
          <option value="">—</option>
          {CLOTHING_FITS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Size</label>
        <select
          className="field"
          value={form.size}
          onChange={(e) => onChange({ ...form, size: e.target.value })}
        >
          {INVENTORY_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Colour</label>
        <select
          className="field"
          value={form.colour}
          onChange={(e) => onChange({ ...form, colour: e.target.value })}
        >
          {colours.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Quantity</label>
        <input
          className="field"
          type="number"
          min={0}
          value={form.quantity}
          onChange={(e) => onChange({ ...form, quantity: e.target.value })}
        />
      </div>
      <div className="md:col-span-2">
        <label className="label">Notes</label>
        <RichTextEditor
          value={form.notes}
          onChange={(notes) => onChange({ ...form, notes })}
          placeholder="Notes…"
          minHeight="70px"
        />
      </div>
    </>
  );
}

export function InventoryClient({
  initial,
}: {
  initial: MerchInventoryItem[];
}) {
  const [items, setItems] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [itemFilter, setItemFilter] = useState("all");
  const [fitFilter, setFitFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/merch/inventory");
    const data = await res.json();
    setItems(data.items ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const itemTypes = useMemo(() => {
    const set = new Set([
      ...CLOTHING_PRODUCTS.map((p) => p.label),
      ...items.map((o) => o.item.trim()).filter(Boolean),
    ]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((o) => {
      if (
        !matchesSearch(search, [
          o.item,
          o.brand,
          o.fit,
          o.size,
          o.colour,
          plainTextFromHtml(o.notes),
        ])
      ) {
        return false;
      }
      if (itemFilter !== "all" && o.item !== itemFilter) return false;
      if (fitFilter === "none" && o.fit) return false;
      if (fitFilter === "male" || fitFilter === "female") {
        if (o.fit !== fitFilter) return false;
      }
      return true;
    });
  }, [items, search, itemFilter, fitFilter]);

  const totalUnits = useMemo(
    () => filtered.reduce((sum, row) => sum + (row.quantity || 0), 0),
    [filtered]
  );

  const editingRow = editingId
    ? items.find((o) => o.id === editingId) ?? null
    : null;

  async function create() {
    await fetch("/api/merch/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        quantity: Number(form.quantity) || 0,
      }),
    });
    setShowForm(false);
    setForm(emptyForm);
    await refresh();
  }

  function openEdit(row: MerchInventoryItem) {
    setEditingId(row.id);
    setEdit(toEditForm(row));
  }

  function closeEdit() {
    setEditingId(null);
    setEdit(null);
  }

  async function saveEdit() {
    if (!editingId || !edit) return;
    setSaving(true);
    try {
      await fetch("/api/merch/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          id: editingId,
          patch: {
            ...edit,
            item: edit.item.trim() || DEFAULT_ITEM,
            quantity: Number(edit.quantity) || 0,
          },
        }),
      });
      closeEdit();
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function adjustQty(id: string, delta: number) {
    const row = items.find((o) => o.id === id);
    if (!row) return;
    const next = Math.max(0, row.quantity + delta);
    setItems((prev) =>
      prev.map((o) => (o.id === id ? { ...o, quantity: next } : o))
    );
    await fetch("/api/merch/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        id,
        patch: { quantity: next },
      }),
    });
    await refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this stock line?")) return;
    await fetch("/api/merch/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    if (editingId === id) closeEdit();
    await refresh();
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-brand">Stock inventory</h2>
          <p className="mt-0.5 text-xs text-muted">
            On-hand kit · {totalUnits} unit{totalUnits === 1 ? "" : "s"} shown
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setShowForm(true)}
        >
          Add stock
        </button>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search item, brand, size…"
        resultCount={filtered.length}
        totalCount={items.length}
        selects={[
          {
            id: "item",
            label: "Item",
            value: itemFilter,
            onChange: setItemFilter,
            options: [
              { value: "all", label: "All items" },
              ...itemTypes.map((i) => ({ value: i, label: i })),
            ],
          },
          {
            id: "fit",
            label: "Fit",
            value: fitFilter,
            onChange: setFitFilter,
            options: [
              { value: "all", label: "All fits" },
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
              { value: "none", label: "No fit / unisex" },
            ],
          },
        ]}
      />

      {showForm ? (
        <div className="surface-card mb-6 grid gap-3 p-5 md:grid-cols-2">
          <InventoryFields form={form} onChange={setForm} />
          <div className="flex gap-2 md:col-span-2">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void create()}
            >
              Save stock line
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

      <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border bg-sand/50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Item</th>
              <th className="px-4 py-3 font-semibold">Fit</th>
              <th className="px-4 py-3 font-semibold">Size</th>
              <th className="px-4 py-3 font-semibold">Colour</th>
              <th className="px-4 py-3 font-semibold">Qty</th>
              <th className="px-4 py-3 font-semibold"> </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "border-b border-border/70 last:border-0",
                  row.quantity === 0 && "opacity-50"
                )}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{row.item}</div>
                  <div className="text-xs text-muted">
                    {row.brand || "—"}
                    {plainTextFromHtml(row.notes)
                      ? ` · ${plainTextFromHtml(row.notes)}`
                      : ""}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted">{fitLabel(row.fit)}</td>
                <td className="px-4 py-3">{row.size || "—"}</td>
                <td className="px-4 py-3">{row.colour || "—"}</td>
                <td className="px-4 py-3">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1 text-xs"
                      aria-label="Decrease quantity"
                      onClick={() => void adjustQty(row.id, -1)}
                    >
                      −
                    </button>
                    <span className="min-w-[1.5rem] text-center font-semibold tabular-nums">
                      {row.quantity}
                    </span>
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1 text-xs"
                      aria-label="Increase quantity"
                      onClick={() => void adjustQty(row.id, 1)}
                    >
                      +
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="btn-secondary px-2.5 py-1.5 text-xs"
                    onClick={() => openEdit(row)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">
            No stock lines match your filters.
          </p>
        ) : null}
      </div>

      {edit && editingRow ? (
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
            aria-label="Edit stock line"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-brand">Edit stock</h2>
              <button
                type="button"
                className="btn-ghost px-2.5 py-1.5 text-xs"
                onClick={closeEdit}
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid gap-2">
                <InventoryFields form={edit} onChange={setEdit} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
              <button
                type="button"
                className="btn-primary"
                disabled={saving}
                onClick={() => void saveEdit()}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={saving}
                onClick={closeEdit}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-ghost text-[var(--danger)]"
                disabled={saving}
                onClick={() => void remove(editingRow.id)}
              >
                Delete
              </button>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
