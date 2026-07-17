"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MerchOrder, MerchStatus } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, matchesSearch } from "@/components/ui/FilterBar";
import { cn } from "@/lib/utils";
import {
  CLOTHING_BRAND,
  CLOTHING_FITS,
  CLOTHING_PRODUCTS,
  CLOTHING_SIZES,
  clothingProductByLabel,
  coloursForItem,
  defaultColourForItem,
  type ClothingFit,
} from "@/lib/merch/north-sails";

const STATUSES: { id: MerchStatus; label: string }[] = [
  { id: "requested", label: "Requested" },
  { id: "approved", label: "Approved" },
  { id: "ordered", label: "Ordered" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];

const MEMBER_STATUSES: { id: MerchStatus; label: string }[] = [
  { id: "requested", label: "Requested" },
  { id: "cancelled", label: "Cancelled" },
];

const DEFAULT_ITEM = CLOTHING_PRODUCTS[0]!.label;

function buildEmptyForm(viewerName = "") {
  return {
    item: DEFAULT_ITEM,
    fit: "male" as ClothingFit | "",
    size: "M",
    quantity: "1",
    colour: defaultColourForItem(DEFAULT_ITEM),
    requested_for: viewerName,
    office: "Southampton",
    needed_by: "",
    status: "requested" as MerchStatus,
    notes: "",
    created_by: viewerName,
  };
}

type EditForm = ReturnType<typeof buildEmptyForm>;

function toEditForm(order: MerchOrder): EditForm {
  return {
    item: order.item,
    fit: (order.fit as ClothingFit | "") || "male",
    size: order.size,
    quantity: String(order.quantity),
    colour: order.colour,
    requested_for: order.requested_for,
    office: order.office,
    needed_by: order.needed_by ?? "",
    status: order.status,
    notes: order.notes,
    created_by: order.created_by,
  };
}

function statusLabel(status: MerchStatus) {
  return STATUSES.find((s) => s.id === status)?.label ?? status;
}

function statusTone(status: MerchStatus) {
  switch (status) {
    case "approved":
      return "bg-sky-50 text-sky-800 border-sky-200";
    case "ordered":
      return "bg-amber-50 text-amber-900 border-amber-200";
    case "delivered":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "cancelled":
      return "bg-slate-100 text-slate-600 border-slate-200";
    default:
      return "bg-violet-50 text-violet-800 border-violet-200";
  }
}

function fitLabel(fit: string) {
  if (fit === "female") return "Female";
  if (fit === "male") return "Male";
  return "";
}

function applyItemChange(form: EditForm, item: string): EditForm {
  const colours = coloursForItem(item);
  const colour = colours.includes(form.colour)
    ? form.colour
    : defaultColourForItem(item);
  return { ...form, item, colour };
}

function OrderFields({
  form,
  onChange,
}: {
  form: EditForm;
  onChange: (next: EditForm) => void;
}) {
  const product = clothingProductByLabel(form.item);
  const colours = coloursForItem(form.item);
  const fit = (form.fit || "male") as ClothingFit;
  const productUrl =
    fit === "female" ? product?.links?.female : product?.links?.male;

  return (
    <>
      <div className="md:col-span-2 rounded-xl border border-border bg-sand/40 px-3 py-2 text-xs text-muted">
        Supplier: <span className="font-medium text-foreground">{CLOTHING_BRAND}</span>
        {product?.material ? ` · ${product.material}` : ""}
        {product?.brand === "Henbury" ? " · shirt via Henbury / promotional store" : ""}
        {productUrl ? (
          <>
            {" · "}
            <a
              href={productUrl}
              target="_blank"
              rel="noreferrer"
              className="text-brand underline-offset-2 hover:underline"
            >
              View product
            </a>
          </>
        ) : null}
      </div>
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
        <label className="label">Fit</label>
        <select
          className="field"
          value={form.fit || "male"}
          onChange={(e) =>
            onChange({ ...form, fit: e.target.value as ClothingFit })
          }
        >
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
          {CLOTHING_SIZES.map((s) => (
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
          min={1}
          value={form.quantity}
          onChange={(e) => onChange({ ...form, quantity: e.target.value })}
        />
      </div>
      <div>
        <label className="label">For</label>
        <input
          className="field"
          placeholder="Name or team"
          value={form.requested_for}
          onChange={(e) =>
            onChange({ ...form, requested_for: e.target.value })
          }
        />
      </div>
      <div>
        <label className="label">Office</label>
        <input
          className="field"
          value={form.office}
          onChange={(e) => onChange({ ...form, office: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Needed by</label>
        <input
          className="field"
          type="date"
          value={form.needed_by}
          onChange={(e) => onChange({ ...form, needed_by: e.target.value })}
        />
      </div>
      <div className="md:col-span-2">
        <label className="label">Notes</label>
        <textarea
          className="field min-h-[70px]"
          value={form.notes}
          onChange={(e) => onChange({ ...form, notes: e.target.value })}
        />
      </div>
    </>
  );
}

export function MerchClient({
  initial,
  hideHeader = false,
  canManageAll = false,
  viewerName = "",
}: {
  initial: MerchOrder[];
  hideHeader?: boolean;
  /** Admins see every order; members only receive their own from the API. */
  canManageAll?: boolean;
  viewerName?: string;
}) {
  const emptyForm = buildEmptyForm(viewerName);
  const statusOptions = canManageAll ? STATUSES : MEMBER_STATUSES;
  const [orders, setOrders] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [itemFilter, setItemFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/merch");
    const data = await res.json();
    setOrders(data.orders ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setForm(buildEmptyForm(viewerName));
  }, [viewerName]);

  const itemTypes = useMemo(() => {
    const set = new Set([
      ...CLOTHING_PRODUCTS.map((p) => p.label),
      ...orders.map((o) => o.item.trim()).filter(Boolean),
    ]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [orders]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (
        !matchesSearch(search, [
          o.item,
          o.fit,
          o.size,
          o.colour,
          o.requested_for,
          o.office,
          o.notes,
          o.created_by,
          o.status,
        ])
      ) {
        return false;
      }
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (itemFilter !== "all" && o.item !== itemFilter) return false;
      return true;
    });
  }, [orders, search, statusFilter, itemFilter]);

  const editingOrder = editingId
    ? orders.find((o) => o.id === editingId) ?? null
    : null;

  async function create() {
    await fetch("/api/merch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        quantity: Number(form.quantity) || 1,
        needed_by: form.needed_by || null,
        created_by: form.created_by || form.requested_for || "Staff",
      }),
    });
    setShowForm(false);
    setForm(buildEmptyForm(viewerName));
    await refresh();
  }

  function openEdit(order: MerchOrder) {
    setEditingId(order.id);
    setEdit(toEditForm(order));
  }

  function closeEdit() {
    setEditingId(null);
    setEdit(null);
  }

  async function saveEdit() {
    if (!editingId || !edit) return;
    setSaving(true);
    try {
      await fetch("/api/merch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          id: editingId,
          patch: {
            ...edit,
            item: edit.item.trim() || DEFAULT_ITEM,
            quantity: Number(edit.quantity) || 1,
            needed_by: edit.needed_by || null,
          },
        }),
      });
      closeEdit();
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: MerchStatus) {
    await fetch("/api/merch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id, patch: { status } }),
    });
    if (editingId === id && edit) setEdit({ ...edit, status });
    await refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this merch order?")) return;
    await fetch("/api/merch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    if (editingId === id) closeEdit();
    await refresh();
  }

  return (
    <div>
      {hideHeader ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-brand">
              {canManageAll ? "Corporate clothing" : "My clothing orders"}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {canManageAll
                ? `${CLOTHING_BRAND} · all staff orders`
                : `${CLOTHING_BRAND} · only your requests are shown`}
            </p>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowForm(true)}
          >
            New order
          </button>
        </div>
      ) : (
        <PageHeader
          title="Corporate clothing"
          description={`${CLOTHING_BRAND} kit — Regatta or Pique polo (navy/white), navy gilet, navy sailor jacket, white collared shirt. Choose male or female fit.`}
          actions={
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowForm(true)}
            >
              New order
            </button>
          }
        />
      )}

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search item, person, office…"
        resultCount={filtered.length}
        totalCount={orders.length}
        selects={[
          {
            id: "status",
            label: "Status",
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "all", label: "All statuses" },
              ...statusOptions.map((s) => ({ value: s.id, label: s.label })),
            ],
          },
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
        ]}
      />

      {showForm ? (
        <div className="surface-card mb-6 grid gap-3 p-5 md:grid-cols-2">
          <OrderFields form={form} onChange={setForm} />
          <div className="flex gap-2 md:col-span-2">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void create()}
            >
              Submit request
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

      <div className="space-y-3">
        {filtered.map((order) => (
          <article key={order.id} className="surface-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl text-brand">
                  {order.item}
                  <span className="ml-2 text-base font-sans font-normal text-muted">
                    · {fitLabel(order.fit) || "—"} · {order.size} · ×
                    {order.quantity}
                  </span>
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {order.colour || "—"}
                  {order.requested_for ? ` · for ${order.requested_for}` : ""}
                  {order.office ? ` · ${order.office}` : ""}
                  {order.needed_by ? ` · needed ${order.needed_by}` : ""}
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  statusTone(order.status)
                )}
              >
                {statusLabel(order.status)}
              </span>
            </div>
            {order.notes ? (
              <p className="mt-3 whitespace-pre-wrap text-sm text-muted">
                {order.notes}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-secondary px-2.5 py-1.5 text-xs"
                onClick={() => openEdit(order)}
              >
                Edit
              </button>
              {canManageAll ||
              order.status === "requested" ||
              order.status === "cancelled" ? (
                <select
                  className="field !w-auto py-1.5 text-xs"
                  value={order.status}
                  onChange={(e) =>
                    void setStatus(order.id, e.target.value as MerchStatus)
                  }
                  aria-label="Change status"
                >
                  {!statusOptions.some((s) => s.id === order.status) ? (
                    <option value={order.status}>
                      {statusLabel(order.status)}
                    </option>
                  ) : null}
                  {statusOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          </article>
        ))}
        {filtered.length === 0 ? (
          <p className="text-sm text-muted">
            {canManageAll
              ? "No clothing orders match your filters."
              : "You have no clothing orders yet. Submit a request to get started."}
          </p>
        ) : null}
      </div>

      {edit && editingOrder ? (
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
            aria-label="Edit clothing order"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-brand">Edit order</h2>
              <button
                type="button"
                className="btn-ghost px-2.5 py-1.5 text-xs"
                onClick={closeEdit}
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid gap-2 md:grid-cols-1">
                <OrderFields form={edit} onChange={setEdit} />
                <div>
                  <label className="label">Status</label>
                  <select
                    className="field"
                    value={edit.status}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        status: e.target.value as MerchStatus,
                      })
                    }
                  >
                    {!statusOptions.some((s) => s.id === edit.status) ? (
                      <option value={edit.status}>
                        {statusLabel(edit.status)}
                      </option>
                    ) : null}
                    {statusOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
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
                onClick={() => void remove(editingOrder.id)}
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
